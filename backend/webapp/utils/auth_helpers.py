"""
Authentication helper functions
"""
from django.http import JsonResponse
from typing import Tuple, Optional
from ..functions import validate_jwt_request
from .response_helpers import error_response


def get_user_from_token(request) -> Tuple[Optional[object], Optional[JsonResponse]]:
    """
    Extract and validate user from JWT token in request
    
    Returns:
        Tuple of (user, error_response)
        - If valid: (user, None)
        - If invalid: (None, JsonResponse error)
    """
    user, error = validate_jwt_request(request)
    return user, error


def require_auth(view_func):
    """
    Decorator to require authentication for a view
    
    Usage:
        @require_auth
        def my_view(request):
            user = request.user  # User is guaranteed to exist
            ...
    """
    def wrapper(request, *args, **kwargs):
        user, error = get_user_from_token(request)
        if error:
            return error
        request.user = user
        return view_func(request, *args, **kwargs)
    return wrapper
