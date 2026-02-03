"""
Script management views - thin HTTP layer
"""
import json
from django.views.decorators.csrf import csrf_exempt
from ..services.script_service import ScriptService
from ..utils.response_helpers import success_response, error_response, validation_error
from ..utils.auth_helpers import get_user_from_token


@csrf_exempt
def create_user_script(request):
    """Create a new Python script"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        name = data.get("name", "").strip()
        code = data.get("code", "").strip()
        description = data.get("description", "").strip()
        
        script, error_msg = ScriptService.create_script(user, name, code, description)
        if error_msg:
            return error_response(error_msg, status_code=400)
        
        return success_response(
            data=ScriptService.serialize_script(script, is_owner=True),
            message="Script created successfully.",
            status_code=201
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error creating script: {str(e)}", status_code=500)


@csrf_exempt
def get_user_scripts(request):
    """Get all scripts for authenticated user"""
    if request.method != 'GET':
        return error_response("Invalid request method. Use GET.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        scripts_data = ScriptService.get_user_scripts(user)
        return success_response(data=scripts_data)
    except Exception as e:
        return error_response(f"Error fetching scripts: {str(e)}", status_code=500)


@csrf_exempt
def get_script_by_id(request, script_id):
    """Get a specific script by ID"""
    if request.method != 'GET':
        return error_response("Invalid request method. Use GET.", status_code=405)
    
    # Try to get user (optional for public scripts)
    user, _ = get_user_from_token(request)
    
    try:
        script, error_msg = ScriptService.get_script_by_id(script_id, user)
        if error_msg:
            return error_response(error_msg, status_code=404)
        
        is_owner = user and script.user.id == user.id
        return success_response(
            data=ScriptService.serialize_script(script, is_owner=is_owner)
        )
    except Exception as e:
        return error_response(f"Error fetching script: {str(e)}", status_code=500)


@csrf_exempt
def update_user_script(request, script_id):
    """Update an existing script"""
    if request.method != 'PUT':
        return error_response("Invalid request method. Use PUT.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        name = data.get("name", "").strip()
        code = data.get("code", "").strip()
        description = data.get("description", "").strip()
        
        script, error_msg = ScriptService.update_script(user, script_id, name, code, description)
        if error_msg:
            return error_response(error_msg, status_code=400 if "not found" not in error_msg.lower() else 404)
        
        return success_response(
            data=ScriptService.serialize_script(script, is_owner=True),
            message="Script updated successfully."
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error updating script: {str(e)}", status_code=500)


@csrf_exempt
def delete_user_script(request, script_id):
    """Delete a script"""
    if request.method != 'DELETE':
        return error_response("Invalid request method. Use DELETE.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        success, error_msg = ScriptService.delete_script(user, script_id)
        if not success:
            return error_response(error_msg, status_code=404)
        
        return success_response(message="Script deleted successfully.")
    except Exception as e:
        return error_response(f"Error deleting script: {str(e)}", status_code=500)


@csrf_exempt
def toggle_script_public(request, script_id):
    """Toggle script public/private status"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        script, error_msg = ScriptService.toggle_public_status(user, script_id)
        if error_msg:
            return error_response(error_msg, status_code=404)
        
        return success_response(
            data=ScriptService.serialize_script(script, is_owner=True),
            message=f"Script is now {'public' if script.is_public else 'private'}."
        )
    except Exception as e:
        return error_response(f"Error updating script: {str(e)}", status_code=500)
