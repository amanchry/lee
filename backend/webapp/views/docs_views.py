"""
Documentation views - serve helper functions documentation
"""
import json
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from pathlib import Path


@csrf_exempt
def get_helper_functions_docs(request):
    """
    Get helper functions documentation from JSON file
    
    Returns:
        JSON response with helper functions documentation
    """
    if request.method != 'GET':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use GET."
        }, status=405)
    
    try:
        # Get the path to the JSON file
        json_file_path = Path(__file__).parent.parent / 'helper_functions_docs.json'
        
        # Check if file exists
        if not json_file_path.exists():
            return JsonResponse({
                "success": False,
                "message": "Documentation file not found"
            }, status=404)
        
        # Read and parse JSON file
        with open(json_file_path, 'r', encoding='utf-8') as f:
            docs_data = json.load(f)
        
        return JsonResponse({
            "success": True,
            "data": docs_data
        })
        
    except json.JSONDecodeError as e:
        return JsonResponse({
            "success": False,
            "message": f"Error parsing documentation file: {str(e)}"
        }, status=500)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error loading documentation: {str(e)}"
        }, status=500)
