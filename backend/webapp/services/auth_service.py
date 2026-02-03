"""
Authentication business logic
"""
import random
import jwt
from typing import Dict, Optional, Tuple
from django.contrib.auth.hashers import make_password, check_password
from django.utils.timezone import now
from datetime import timedelta
from django.conf import settings
from ..models import User, OTPVerification
from ..functions import send_otp


class AuthService:
    """Service for authentication and user management"""
    
    @staticmethod
    def generate_jwt_token(user: User) -> str:
        """Generate JWT token for user"""
        expires_at = now() + timedelta(days=2)
        payload = {
            "user_id": user.id,
            "email": user.email,
            "exp": expires_at,
            "iat": now(),
        }
        token_str = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
        if isinstance(token_str, bytes):
            token_str = token_str.decode("utf-8")
        return token_str
    
    @staticmethod
    def login_user(email: str, password: str, tool: str = "earthcode") -> Tuple[Optional[Dict], Optional[str]]:
        """
        Authenticate user and return user data with token
        
        Returns:
            Tuple of (user_data_dict, error_message)
        """
        username = f"{email.split('@')[0]}_{tool}"
        
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return None, "Invalid login credentials"
        
        if not check_password(password, user.password):
            return None, "Invalid login credentials"
        
        if not user.is_active:
            return None, "User account is not activated"
        
        token = AuthService.generate_jwt_token(user)
        
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "username": user.username,  # Include username
            "token": token
        }, None
    
    @staticmethod
    def send_otp_email(email: str, tool: str = "earthcode") -> Tuple[bool, Optional[str]]:
        """
        Send OTP email to user
        
        Returns:
            Tuple of (success, error_message)
        """
        username = f"{email.split('@')[0]}_{tool}"
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return False, "User with this email already exists."
        
        # Generate OTP
        otp = random.randint(100000, 999999)
        expires_at = now() + timedelta(minutes=10)
        
        # Mark old OTPs as used
        OTPVerification.objects.filter(email=email, is_used=False).update(is_used=True)
        
        # Create new OTP record
        otp_record = OTPVerification.objects.create(
            email=email,
            otp=str(otp),
            expires_at=expires_at
        )
        
        # Send OTP email
        result = send_otp(email, otp)
        
        if result.get("status") == "success":
            return True, None
        else:
            return False, result.get("result", "Failed to send OTP")
    
    @staticmethod
    def verify_otp(email: str, otp: str) -> Tuple[bool, Optional[str]]:
        """
        Verify OTP code
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            otp_record = OTPVerification.objects.filter(
                email=email,
                is_used=False
            ).order_by('-created_at').first()
            
            if not otp_record:
                return False, "No valid OTP found for this email."
            
            if otp_record.is_expired():
                return False, "OTP has expired. Please request a new one."
            
            if otp_record.otp != otp:
                return False, "Invalid OTP code."
            
            # Mark OTP as verified and used
            otp_record.is_verified = True
            otp_record.is_used = True
            otp_record.save()
            
            return True, None
        except Exception as e:
            return False, f"Error verifying OTP: {str(e)}"
    
    @staticmethod
    def create_account(email: str, name: str, password: str, tool: str = "earthcode") -> Tuple[Optional[User], Optional[str]]:
        """
        Create a new user account
        
        Returns:
            Tuple of (user, error_message)
        """
        username = f"{email.split('@')[0]}_{tool}"
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return None, "User with this email already exists."
        
        # Verify OTP was verified
        otp_record = OTPVerification.objects.filter(
            email=email,
            is_verified=True,
            is_used=True
        ).order_by('-created_at').first()
        
        if not otp_record:
            return None, "Please verify your email with OTP first."
        
        try:
            hashed_password = make_password(password)
            user = User.objects.create(
                username=username,
                name=name,
                email=email,
                password=hashed_password,
                tool=tool,
                is_active=True
            )
            
            # Ensure user folders are created
            from ..services.file_service import FileService
            FileService.ensure_user_folders(user)
            
            return user, None
        except Exception as e:
            return None, f"Error creating account: {str(e)}"
