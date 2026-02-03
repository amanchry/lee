"""
Authentication views - thin HTTP layer
"""
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from ..services.auth_service import AuthService
from ..utils.response_helpers import success_response, error_response, validation_error
from ..utils.auth_helpers import get_user_from_token


@csrf_exempt
def login_view(request):
    """User login endpoint"""
    if request.method != "POST":
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
        tool = data.get("tool", "earthcode")
        
        if not email or not password:
            return validation_error("Email and password are required.")
        
        user_data, error = AuthService.login_user(email, password, tool)
        if error:
            return error_response(error, status_code=401)
        
        return success_response(
            data=user_data,
            message="Logged in successfully",
            status_code=200
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Server error: {str(e)}", status_code=500)


@csrf_exempt
def send_email_otp_view(request):
    """Send OTP email endpoint"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    try:
        data = json.loads(request.body)
        email = data.get("email")
        tool = data.get("tool", "earthcode")
        
        if not email:
            return validation_error("Email is required.")
        
        success, error = AuthService.send_otp_email(email, tool)
        if not success:
            return error_response(error, status_code=400)
        
        return success_response(message="OTP sent successfully.")
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Server error: {str(e)}", status_code=500)


@csrf_exempt
def verify_otp_view(request):
    """Verify OTP endpoint"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    try:
        data = json.loads(request.body)
        email = data.get("email")
        otp = data.get("otp")
        
        if not email or not otp:
            return validation_error("Email and OTP are required.")
        
        is_valid, error = AuthService.verify_otp(email, otp)
        if not is_valid:
            return error_response(error, status_code=400)
        
        return success_response(message="OTP verified successfully.")
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Server error: {str(e)}", status_code=500)


@csrf_exempt
def create_account_view(request):
    """Create user account endpoint"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    try:
        data = json.loads(request.body)
        email = data.get("email")
        name = data.get("name")
        password = data.get("password")
        tool = data.get("tool", "earthcode")
        
        if not email or not password or not name:
            return validation_error("Email, Name and Password are required.")
        
        user, error = AuthService.create_account(email, name, password, tool)
        if error:
            return error_response(error, status_code=400)
        
        # Generate token for immediate login
        token = AuthService.generate_jwt_token(user)
        
        return success_response(
            data={
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "username": user.username,  # Include username
                "token": token
            },
            message="Account created successfully.",
            status_code=201
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Server error: {str(e)}", status_code=500)
