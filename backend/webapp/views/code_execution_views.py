"""
Code execution views - thin HTTP layer
"""
import json
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now
from ..services.code_execution_service import CodeExecutionService
from ..utils.response_helpers import success_response, error_response, validation_error
from ..utils.auth_helpers import get_user_from_token


@csrf_exempt
def execute_python_code(request):
    """Execute Python code safely"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        code = data.get("code", "").strip()
        
        result, error_msg = CodeExecutionService.execute_code(user, code)
        
        if error_msg:
            # Handle timeout separately
            if "timeout" in error_msg.lower():
                return error_response(
                    error_msg,
                    status_code=408,
                    output=[{
                        "type": "error",
                        "message": f"Execution timeout: {error_msg}",
                        "timestamp": now().isoformat()
                    }]
                )
            return error_response(error_msg, status_code=400)
        
        return success_response(data=result)
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Server error: {str(e)}", status_code=500)
