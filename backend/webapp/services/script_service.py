"""
Script management business logic
"""
from typing import Dict, List, Optional, Tuple
from django.core.exceptions import ValidationError
from ..models import Script, User
from ..utils.response_helpers import error_response


class ScriptService:
    """Service for managing user scripts"""
    
    @staticmethod
    def create_script(user: User, name: str, code: str, description: str = "") -> Tuple[Optional[Script], Optional[str]]:
        """
        Create a new script for a user
        
        Returns:
            Tuple of (script, error_message)
        """
        if not name or not name.strip():
            return None, "Script name is required."
        
        name = name.strip()
        code = code.strip() if code else ""  # Allow empty code for blank scripts
        description = description.strip() if description else ""
        
        # Check for duplicate name
        if Script.objects.filter(user=user, name=name).exists():
            return None, "A script with this name already exists."
        
        try:
            script = Script.objects.create(
                user=user,
                name=name,
                code=code,
                description=description
            )
            return script, None
        except Exception as e:
            return None, f"Error creating script: {str(e)}"
    
    @staticmethod
    def get_user_scripts(user: User) -> List[Dict]:
        """Get all scripts for a user"""
        scripts = Script.objects.filter(user=user).order_by('-updated_at')
        return [
            {
                "id": script.id,
                "name": script.name,
                "code": script.code,
                "description": script.description,
                "created_at": script.created_at.isoformat(),
                "updated_at": script.updated_at.isoformat(),
                "is_public": script.is_public
            }
            for script in scripts
        ]
    
    @staticmethod
    def get_script_by_id(script_id: int, requesting_user: Optional[User] = None) -> Tuple[Optional[Script], Optional[str]]:
        """
        Get a script by ID
        
        Returns:
            Tuple of (script, error_message)
        """
        try:
            script = Script.objects.get(id=script_id)
        except Script.DoesNotExist:
            return None, "Script not found."
        
        # Check access permissions
        is_owner = requesting_user and script.user.id == requesting_user.id
        if not script.is_public and not is_owner:
            return None, "Script not found or access denied."
        
        return script, None
    
    @staticmethod
    def update_script(user: User, script_id: int, name: str, code: str, description: str = "") -> Tuple[Optional[Script], Optional[str]]:
        """
        Update an existing script
        
        Returns:
            Tuple of (script, error_message)
        """
        try:
            script = Script.objects.get(id=script_id, user=user)
        except Script.DoesNotExist:
            return None, "Script not found or you don't have permission to edit it."
        
        if not name or not name.strip():
            return None, "Script name is required."
        
        name = name.strip()
        code = code.strip() if code else ""  # Allow empty code
        description = description.strip() if description else ""
        
        # Check for duplicate name (excluding current script)
        if name != script.name and Script.objects.filter(user=user, name=name).exists():
            return None, "A script with this name already exists."
        
        try:
            script.name = name
            script.code = code
            script.description = description
            script.save()
            return script, None
        except Exception as e:
            return None, f"Error updating script: {str(e)}"
    
    @staticmethod
    def delete_script(user: User, script_id: int) -> Tuple[bool, Optional[str]]:
        """
        Delete a script
        
        Returns:
            Tuple of (success, error_message)
        """
        try:
            script = Script.objects.get(id=script_id, user=user)
            script.delete()
            return True, None
        except Script.DoesNotExist:
            return False, "Script not found or you don't have permission to delete it."
        except Exception as e:
            return False, f"Error deleting script: {str(e)}"
    
    @staticmethod
    def toggle_public_status(user: User, script_id: int) -> Tuple[Optional[Script], Optional[str]]:
        """
        Toggle script public/private status
        
        Returns:
            Tuple of (script, error_message)
        """
        try:
            script = Script.objects.get(id=script_id, user=user)
            script.is_public = not script.is_public
            script.save()
            return script, None
        except Script.DoesNotExist:
            return None, "Script not found or you don't have permission to edit it."
        except Exception as e:
            return None, f"Error updating script: {str(e)}"
    
    @staticmethod
    def serialize_script(script: Script, is_owner: bool = False) -> Dict:
        """Serialize script to dict"""
        return {
            "id": script.id,
            "name": script.name,
            "code": script.code,
            "description": script.description,
            "created_at": script.created_at.isoformat(),
            "updated_at": script.updated_at.isoformat(),
            "is_public": script.is_public,
            "author": script.user.name,
            "is_owner": is_owner
        }
