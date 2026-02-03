"""
Standardized API response helpers
"""
from django.http import JsonResponse
from typing import Any, Dict, Optional


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
    **kwargs
) -> JsonResponse:
    """
    Create a standardized success response
    
    Args:
        data: Response data (dict, list, or any serializable object)
        message: Success message
        status_code: HTTP status code
        **kwargs: Additional fields to include in response
    
    Returns:
        JsonResponse with standardized format
    """
    response = {
        "success": True,
        "message": message,
    }
    
    if data is not None:
        response["data"] = data
    
    response.update(kwargs)
    
    return JsonResponse(response, status=status_code)


def error_response(
    message: str = "An error occurred",
    status_code: int = 400,
    errors: Optional[Dict[str, Any]] = None,
    **kwargs
) -> JsonResponse:
    """
    Create a standardized error response
    
    Args:
        message: Error message
        status_code: HTTP status code
        errors: Optional dict of field-specific errors
        **kwargs: Additional fields to include in response
    
    Returns:
        JsonResponse with standardized format
    """
    response = {
        "success": False,
        "message": message,
    }
    
    if errors:
        response["errors"] = errors
    
    response.update(kwargs)
    
    return JsonResponse(response, status=status_code)


def validation_error(
    message: str = "Validation failed",
    errors: Optional[Dict[str, Any]] = None
) -> JsonResponse:
    """
    Create a validation error response (400 status)
    
    Args:
        message: Error message
        errors: Dict of field-specific validation errors
    
    Returns:
        JsonResponse with 400 status
    """
    return error_response(message=message, status_code=400, errors=errors)
