
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.http import JsonResponse, Http404, HttpResponse,FileResponse
from django.http import StreamingHttpResponse
from django.contrib.auth.hashers import make_password
import json
from django.utils import timezone
import os
import random
from django.core.serializers import serialize
from django.conf import settings
from django.contrib.auth.hashers import check_password
# from django.contrib.auth.models import User
from .models import User, Area, OTPVerification, Script

from django.db import models
import geopandas as gpd
from django.contrib.gis.geos import Point, LineString, Polygon, MultiPolygon, MultiLineString, MultiPoint
from django.contrib.gis.geos import GEOSGeometry
from osgeo import gdal, osr
from dotenv import load_dotenv
from django.db.models import Q
from django.db.models.expressions import RawSQL
import numpy as np
from datetime import timedelta, datetime
from django.utils.timezone import now
from django.core.serializers.json import DjangoJSONEncoder
from .functions import send_otp,send_contact_email
import shutil
from math import floor
from pyproj import CRS
import requests
import jwt
from .functions import validate_jwt_request
import uuid
import hashlib
import subprocess
import tempfile
import threading
import zipfile
import time
import re
from pathlib import Path

load_dotenv()

base_url = settings.BASE_URL






@csrf_exempt
def showHome(request):
    return HttpResponse("Backend WebApp")





@csrf_exempt
def UserRegisterView(request):
    if request.method == "POST":
        # try:
            # Parse JSON request body
            data = json.loads(request.body)
            email = data.get("email")
            name = data.get("name")
            password = data.get("password")
            tool = data.get("tool", "earthcode")
            username= f"{email.split('@')[0]}_{tool}"


            if not email or not password or not name:
                return JsonResponse({"success": False, "message": "Email, Name and Password are required"}, status=400)
            
            if User.objects.filter(username=username).exists():
                return JsonResponse({"success": False, "message": "User with this email already exists."}, status=400)
            
            
            hashed_password = make_password(password)

            user = User.objects.create(
                username= username,
                name=name,
                email=email,
                password=hashed_password,
                tool=tool
            )

            user.save()

            

            return JsonResponse({
                "success": True,
                "message": "User registered successfully, please verify your email."
            }, status=201)


        # except json.JSONDecodeError:
        #     return JsonResponse({"success": False, "message": "Invalid JSON data"}, status=400)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)






@csrf_exempt
def send_email_otp(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse({
                    "success": False,
                    "message": "Email is required."
                }, status=400)

            # Check if user already exists
            tool = data.get("tool", "earthcode")
            username = f"{email.split('@')[0]}_{tool}"
            if User.objects.filter(username=username).exists():
                return JsonResponse({
                    "success": False,
                    "message": "User with this email already exists."
                }, status=400)

            # Generate OTP
            otp = random.randint(100000, 999999)

            # Store OTP in database with expiration (10 minutes)
            expires_at = now() + timedelta(minutes=10)
            
            # Mark old OTPs for this email as used
            OTPVerification.objects.filter(email=email, is_used=False).update(is_used=True)
            
            # Create new OTP record
            otp_record = OTPVerification.objects.create(
                email=email,
                otp=str(otp),
                expires_at=expires_at
            )

            # Send OTP via email
            result = send_otp(email, otp)

            if result.get('status') == 'error':
                otp_record.delete()  # Delete OTP record if email failed
                return JsonResponse({
                    "success": False,
                    "message": "Failed to send OTP.",
                    "error": result.get("error")
                }, status=500)

            return JsonResponse({
                "success": True,
                "message": "OTP sent to your email. Please check your inbox."
            }, status=201)
        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "message": "Invalid JSON data."
            }, status=400)
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Error: {str(e)}"
            }, status=500)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)


@csrf_exempt
def verify_otp(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get("email")
            otp = data.get("otp")

            if not email or not otp:
                return JsonResponse({
                    "success": False,
                    "message": "Email and OTP are required."
                }, status=400)

            # Find the most recent unverified OTP for this email
            try:
                otp_record = OTPVerification.objects.filter(
                    email=email,
                    is_used=False,
                    is_verified=False
                ).order_by('-created_at').first()

                if not otp_record:
                    return JsonResponse({
                        "success": False,
                        "message": "No OTP found for this email. Please request a new one."
                    }, status=404)

                # Check if OTP is expired
                if otp_record.is_expired():
                    otp_record.is_used = True
                    otp_record.save()
                    return JsonResponse({
                        "success": False,
                        "message": "OTP has expired. Please request a new one."
                    }, status=400)

                # Verify OTP
                if otp_record.otp != str(otp):
                    return JsonResponse({
                        "success": False,
                        "message": "Invalid OTP. Please try again."
                    }, status=400)

                # Mark OTP as verified
                otp_record.is_verified = True
                otp_record.save()

                return JsonResponse({
                    "success": True,
                    "message": "OTP verified successfully."
                }, status=200)

            except Exception as e:
                return JsonResponse({
                    "success": False,
                    "message": f"Error verifying OTP: {str(e)}"
                }, status=500)

        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "message": "Invalid JSON data."
            }, status=400)
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Error: {str(e)}"
            }, status=500)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)


@csrf_exempt
def create_account(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get("email")
            name = data.get("name")
            password = data.get("password")
            confirmPassword = data.get("confirmPassword")
            tool = data.get("tool", "earthcode")

            # Validation
            if not email or not name or not password:
                return JsonResponse({
                    "success": False,
                    "message": "Email, name, and password are required."
                }, status=400)

            if password != confirmPassword:
                return JsonResponse({
                    "success": False,
                    "message": "Passwords do not match."
                }, status=400)

            if len(password) < 8:
                return JsonResponse({
                    "success": False,
                    "message": "Password must be at least 8 characters long."
                }, status=400)

            # Check if OTP was verified
            otp_record = OTPVerification.objects.filter(
                email=email,
                is_verified=True,
                is_used=False
            ).order_by('-created_at').first()

            if not otp_record:
                return JsonResponse({
                    "success": False,
                    "message": "Please verify your email with OTP first."
                }, status=400)

            # Check if OTP is still valid (not expired)
            if otp_record.is_expired():
                return JsonResponse({
                    "success": False,
                    "message": "OTP verification has expired. Please start the registration process again."
                }, status=400)

            # Check if user already exists
            username = f"{email.split('@')[0]}_{tool}"
            if User.objects.filter(username=username).exists():
                return JsonResponse({
                    "success": False,
                    "message": "User with this email already exists."
                }, status=400)

            # Create user
            hashed_password = make_password(password)
            user = User.objects.create(
                username=username,
                name=name,
                email=email,
                password=hashed_password,
                tool=tool,
                is_active=True  # Activate user after OTP verification
            )

            # Create user's folder structure (user folder and assets subfolder)
            ensure_user_folders(user)

            # Mark OTP as used
            otp_record.is_used = True
            otp_record.save()

            # Generate JWT token for immediate login
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

            return JsonResponse({
                "success": True,
                "message": "Account created successfully.",
                "data": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "token": token_str
                }
            }, status=201)

        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "message": "Invalid JSON data."
            }, status=400)
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Error creating account: {str(e)}"
            }, status=500)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)


@csrf_exempt
def forgot_password(request):
    if request.method == "POST":
        try:
            # Parse JSON request body
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")
            tool = data.get("tool")
            username= f"{email.split('@')[0]}_{tool}"


            if not email or not password:
                return JsonResponse({
                    "success": False,
                    "message": "Email and new password are required."
                }, status=400)
            

            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return JsonResponse({
                    "success": False,
                    "message": "No user found with this email."
                }, status=404)

            user.password = make_password(password)
            user.save()

            return JsonResponse({
                "success": True,
                "message": "Password reset successful."
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "message": "Invalid JSON format."
            }, status=400)

        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Error: {str(e)}"
            }, status=500)

    return JsonResponse({
        "success": False,
        "message": "Invalid request method."
    }, status=405)




@csrf_exempt
def loginView(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")
            tool = data.get("tool", "earthcode")  # Default to "earthcode" if not provided

            username = f"{email.split('@')[0]}_{tool}"

            if not email or not password:
                return JsonResponse({"success": False, "message": "Email and password are required"}, status=400)

            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return JsonResponse({"success": False, "message": "Invalid login credentials"}, status=401)

            if not check_password(password, user.password):
                return JsonResponse({"success": False, "message": "Invalid login credentials"}, status=401)
            
            if not user.is_active:
                return JsonResponse({"success": False, "message": "User account is not activated"}, status=403)
        

            expires_at = now() + timedelta(days=2)
            payload = {
                "user_id": user.id,
                "email": user.email,
                "exp": expires_at,
                "iat": now(),
            }


            token_str = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

            # For PyJWT >= 2.0, token is already str. For older versions, decode.
            if isinstance(token_str, bytes):
                token_str = token_str.decode("utf-8")



            return JsonResponse({
                "success": True,
                "message": "Logged in successfully",
                "data": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "token": token_str
                }
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON data"}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)}, status=500)

    return JsonResponse({"success": False, "message": "Invalid request method"}, status=405)


    

@csrf_exempt
def logoutView(request):
    # In stateless JWT, logout = client deletes token
    return JsonResponse({"success": True, "message": "Logged out successfully"}, status=200)










@csrf_exempt
def get_area_geometry(request, areaId):
    if request.method == "GET":
        user, error = validate_jwt_request(request)
        if error:
            return error
        print("user",user)
        

        try:
            area = Area.objects.get(id=areaId, user=user)
        except Area.DoesNotExist:
            raise Http404("Area not found")

        geojson = json.loads(serialize('geojson', [area], geometry_field='geom'))['features'][0]
        geometry = geojson['geometry']

        return JsonResponse({
            'id': area.id,
            'name': area.name,
            'geometry': geometry
        })
    


@csrf_exempt
def deleteAreaGeom(request, id):
    if request.method == "DELETE":
        user, error = validate_jwt_request(request)
        if error:
            return error

        try:
            area = Area.objects.get(id=id, user=user)
            area_name =area.name
        except Area.DoesNotExist:
            raise Http404("Area not found")

        area.delete()

        return JsonResponse({'message': f'Area {area_name} deleted successfully.'})

    return JsonResponse({'message': 'Invalid request method. Use DELETE.'}, status=405)









@csrf_exempt
def saveDrawGeojson(request):
    if request.method == 'POST':
        user, error = validate_jwt_request(request)
        if error:
            return error

        # try:
        data = json.loads(request.body)
        featureName = data.get('name')
        geoJson_str = data.get('geom')


        if not featureName:
            return JsonResponse({"result": "Feature name is required"}, status=400)
        if not geoJson_str:
            return JsonResponse({"result": "The geometry was not set"}, status=400)

            
        
        geojson = json.loads(geoJson_str)
        gdf = gpd.GeoDataFrame.from_features(geojson["features"])

        if gdf.crs and gdf.crs != 'EPSG:4326':
            gdf = gdf.to_crs('EPSG:4326')
        else:
            gdf.set_crs('EPSG:4326', inplace=True)
        
        merged_geometry = gdf.unary_union
        if merged_geometry.is_empty:
            return JsonResponse({"result": "Empty geometry after merge"}, status=400)
        
        
        geom = GEOSGeometry(merged_geometry.wkt)
        if isinstance(geom, Polygon):
            geom = MultiPolygon([geom])
        elif isinstance(geom, LineString):
            geom = MultiLineString([geom])
        elif isinstance(geom, Point):
            geom = MultiPoint([geom])

        if not isinstance(geom, (MultiPolygon, MultiLineString, MultiPoint)):
            return JsonResponse({"result": "Unsupported geometry type"}, status=400)

            
        area = Area(
            name=featureName,
            geom=geom,
            user=user,
        )
        area.save()



        return JsonResponse({'message': 'Area added successfully!',})

        
        # except ValidationError as ve:
        #     return JsonResponse({"message": str(ve.messages[0])}, status=400)

        # except Exception as e:
        #     return JsonResponse({'message': f'Backend error: {str(e)}'}, status=500)

    return JsonResponse({'message': 'Invalid request method'}, status=405)




@csrf_exempt
def getAddedAreasList(request):
    user, error = validate_jwt_request(request)
    if error:
        return error

    areas = Area.objects.filter(user=user).values('id', 'name')

    data = list(areas)
    
    return JsonResponse(data, safe=False)











def upload_area_geom(geoJson_str, featureName, user):
    """
    Given a geometry (WKT, GeoJSON, or GEOSGeometry), return
    the Area.id that spatially matches or contains it.
    Returns None if no match is found.
    """
    # Normalize input type
    geojson = json.loads(geoJson_str)

    existing = Area.objects.filter(user=user, name__iexact=featureName).first()
    if existing:
        return existing.id
    

    # ✅ Normalize into list of features
    if geojson.get("type") == "FeatureCollection":
        features = geojson["features"]
    elif geojson.get("type") == "Feature":
        features = [geojson]
    elif geojson.get("type") in [
        "Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"
    ]:
        # Raw geometry — wrap as Feature
        features = [{
            "type": "Feature",
            "properties": {},
            "geometry": geojson
        }]
    else:
        raise ValueError(f"Unsupported GeoJSON type: {geojson.get('type')}")

    gdf = gpd.GeoDataFrame.from_features(features)

    if gdf.crs and gdf.crs != 'EPSG:4326':
        gdf = gdf.to_crs('EPSG:4326')
    else:
        gdf.set_crs('EPSG:4326', inplace=True)
    
    merged_geometry = gdf.unary_union
    if merged_geometry.is_empty:
        return JsonResponse({"result": "Empty geometry after merge"}, status=400)
    
    
    geom = GEOSGeometry(merged_geometry.wkt)
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])
    elif isinstance(geom, LineString):
        geom = MultiLineString([geom])
    elif isinstance(geom, Point):
        geom = MultiPoint([geom])

    if not isinstance(geom, (MultiPolygon, MultiLineString, MultiPoint)):
        return JsonResponse({"result": "Unsupported geometry type"}, status=400)


    # Search for the Area that contains or overlaps it
    area = Area(
        name=featureName,
        geom=geom,
        user=user,
    )
    area.save()

    return area.id if area else None


@csrf_exempt
def execute_python_code(request):
    """
    Execute Python code safely and return stdout/stderr output.
    This endpoint runs Python code in a subprocess with timeout protection.
    """
    if request.method != 'POST':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use POST."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        code = data.get("code", "").strip()

        if not code:
            return JsonResponse({
                "success": False,
                "message": "No code provided."
            }, status=400)

        # Basic security checks - prevent dangerous operations
        # Check for direct dangerous operations (not through libraries)
        import re
        
        dangerous_patterns = [
            (r'\bos\.system\s*\(', 'os.system()'),
            (r'\bsubprocess\s*\.', 'subprocess module'),
            (r'__import__\s*\(', '__import__()'),
            (r'\beval\s*\(', 'eval()'),
            (r'\bexec\s*\(', 'exec()'),
            (r'\bcompile\s*\(', 'compile()'),
            (r'\binput\s*\(', 'input()'),
            (r'\braw_input\s*\(', 'raw_input()'),
            # Block direct open() calls but allow:
            # - library.open() (e.g., rasterio.open, gdal.Open)  
            # - with open() context manager (needed for file I/O)
            # Block: standalone open(...) calls (but this is too restrictive, so we'll allow open for now)
            # Note: File operations are needed for geospatial work
            # (r'(?<!with\s)(?<!\.)\bopen\s*\(', 'direct open() - use "with open()" or library functions'),
            (r'(?<!\.)\bfile\s*\(', 'file()'),
        ]

        code_lower = code.lower()
        for pattern, description in dangerous_patterns:
            if re.search(pattern, code_lower):
                return JsonResponse({
                    "success": False,
                    "message": f"Code contains restricted operation: {description}"
                }, status=400)

        # Create a temporary Python file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file.write(code)
            temp_file_path = temp_file.name

        try:
            # Get user's media directory
            user_media_dir = get_user_media_dir(user)
            user_assets_dir = os.path.join(user_media_dir, "assets")
            
            # Set up environment variables for the script
            env = os.environ.copy()
            env['USER_MEDIA_DIR'] = user_media_dir
            env['USER_ASSETS_DIR'] = user_assets_dir
            env['USER_ID'] = str(user.id)
            
            # Execute Python code with timeout (30 seconds)
            result = subprocess.run(
                ['python3', temp_file_path],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=tempfile.gettempdir(),  # Run in temp directory
                env=env  # Pass environment variables
            )

            # Prepare output
            stdout_lines = result.stdout.split('\n') if result.stdout else []
            stderr_lines = result.stderr.split('\n') if result.stderr else []

            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass

            # Format output for console
            output_logs = []
            
            # Get current timestamp in ISO format
            current_timestamp = now().isoformat()
            
            # Add stdout lines
            for line in stdout_lines:
                if line.strip():  # Only add non-empty lines
                    output_logs.append({
                        "type": "log",
                        "message": line,
                        "timestamp": current_timestamp
                    })

            # Add stderr lines as errors
            for line in stderr_lines:
                if line.strip():  # Only add non-empty lines
                    output_logs.append({
                        "type": "error",
                        "message": line,
                        "timestamp": current_timestamp
                    })

            # Add execution status
            if result.returncode == 0:
                output_logs.append({
                    "type": "success",
                    "message": f"Script executed successfully (exit code: {result.returncode})",
                    "timestamp": current_timestamp
                })
            else:
                output_logs.append({
                    "type": "error",
                    "message": f"Script execution failed (exit code: {result.returncode})",
                    "timestamp": current_timestamp
                })

            return JsonResponse({
                "success": True,
                "output": output_logs,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }, status=200)

        except subprocess.TimeoutExpired:
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass

            return JsonResponse({
                "success": False,
                "message": "Code execution timed out (30 seconds limit).",
                "output": [{
                    "type": "error",
                    "message": "Execution timeout: Code took longer than 30 seconds to execute.",
                    "timestamp": now().isoformat()
                }]
            }, status=408)

        except Exception as e:
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass

            return JsonResponse({
                "success": False,
                "message": f"Error executing code: {str(e)}",
                "output": [{
                    "type": "error",
                    "message": f"Execution error: {str(e)}",
                    "timestamp": now().isoformat()
                }]
            }, status=500)

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data."
        }, status=400)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Server error: {str(e)}"
        }, status=500)


def get_user_media_dir(user):
    """Get the user's media directory path"""
    return os.path.join(settings.MEDIA_ROOT, f"user_{user.id}")


def ensure_user_folders(user):
    """Ensure user's folder structure exists (user folder and assets subfolder)"""
    user_dir = get_user_media_dir(user)
    assets_dir = os.path.join(user_dir, "assets")
    
    # Create user directory if it doesn't exist
    os.makedirs(user_dir, exist_ok=True)
    # Create assets subfolder if it doesn't exist
    os.makedirs(assets_dir, exist_ok=True)
    
    return user_dir, assets_dir


@csrf_exempt
def upload_user_file(request):
    """
    Upload files (GeoJSON, Shapefiles) to user's folder.
    Supports uploading to specific subfolders.
    """
    if request.method != 'POST':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use POST."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        # Get folder path (default to 'assets')
        folder_path = request.POST.get('folder_path', 'assets')
        
        # Ensure user folders exist
        user_dir, assets_dir = ensure_user_folders(user)
        
        # Build target directory path
        if folder_path == 'assets' or folder_path == '':
            target_dir = assets_dir
        else:
            # Allow subfolders within user directory
            target_dir = os.path.join(user_dir, folder_path)
            # Security: prevent directory traversal
            target_dir = os.path.normpath(target_dir)
            if not target_dir.startswith(user_dir):
                return JsonResponse({
                    "success": False,
                    "message": "Invalid folder path."
                }, status=400)
            os.makedirs(target_dir, exist_ok=True)

        # Check if file was uploaded
        if 'file' not in request.FILES:
            return JsonResponse({
                "success": False,
                "message": "No file provided."
            }, status=400)

        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name
        
        # Validate file extension
        allowed_extensions = ['.geojson', '.json', '.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx']
        file_ext = os.path.splitext(file_name)[1].lower()
        
        if file_ext not in allowed_extensions:
            return JsonResponse({
                "success": False,
                "message": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
            }, status=400)

        # Save file
        file_path = os.path.join(target_dir, file_name)
        
        # Handle overwrite
        if os.path.exists(file_path):
            # Add timestamp to filename if file exists
            name, ext = os.path.splitext(file_name)
            file_name = f"{name}_{int(time.time())}{ext}"
            file_path = os.path.join(target_dir, file_name)

        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Get relative path for URL
        relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
        file_url = os.path.join(settings.MEDIA_URL, relative_path).replace('\\', '/')

        return JsonResponse({
            "success": True,
            "message": "File uploaded successfully.",
            "data": {
                "file_name": file_name,
                "file_path": relative_path,
                "file_url": file_url,
                "file_size": file_size,
                "folder_path": folder_path
            }
        }, status=201)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error uploading file: {str(e)}"
        }, status=500)


@csrf_exempt
def create_user_folder(request):
    """Create a new folder/subfolder in user's directory"""
    if request.method != 'POST':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use POST."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        folder_name = data.get("folder_name", "").strip()
        parent_folder = data.get("parent_folder", "assets").strip()

        if not folder_name:
            return JsonResponse({
                "success": False,
                "message": "Folder name is required."
            }, status=400)

        # Validate folder name (prevent directory traversal)
        if '..' in folder_name or '/' in folder_name or '\\' in folder_name:
            return JsonResponse({
                "success": False,
                "message": "Invalid folder name."
            }, status=400)

        # Ensure user folders exist
        user_dir, assets_dir = ensure_user_folders(user)

        # Build target directory path
        if parent_folder == 'assets' or parent_folder == '':
            target_dir = os.path.join(assets_dir, folder_name)
        else:
            target_dir = os.path.join(user_dir, parent_folder, folder_name)
            # Security: prevent directory traversal
            target_dir = os.path.normpath(target_dir)
            if not target_dir.startswith(user_dir):
                return JsonResponse({
                    "success": False,
                    "message": "Invalid parent folder path."
                }, status=400)

        # Create folder
        os.makedirs(target_dir, exist_ok=True)

        # Get relative path
        relative_path = os.path.relpath(target_dir, settings.MEDIA_ROOT)

        return JsonResponse({
            "success": True,
            "message": "Folder created successfully.",
            "data": {
                "folder_name": folder_name,
                "folder_path": relative_path,
                "parent_folder": parent_folder
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data."
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error creating folder: {str(e)}"
        }, status=500)


@csrf_exempt
def list_user_files(request):
    """List files and folders in user's directory"""
    if request.method != 'GET':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use GET."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        # Get folder path from query parameter (default to 'assets')
        folder_path = request.GET.get('folder_path', 'assets')
        
        # Ensure user folders exist
        user_dir, assets_dir = ensure_user_folders(user)

        # Build target directory path
        if folder_path == 'assets' or folder_path == '':
            target_dir = assets_dir
        else:
            target_dir = os.path.join(user_dir, folder_path)
            # Security: prevent directory traversal
            target_dir = os.path.normpath(target_dir)
            if not target_dir.startswith(user_dir):
                return JsonResponse({
                    "success": False,
                    "message": "Invalid folder path."
                }, status=400)

        if not os.path.exists(target_dir):
            return JsonResponse({
                "success": True,
                "data": {
                    "files": [],
                    "folders": [],
                    "current_path": folder_path
                }
            }, status=200)

        files = []
        folders = []

        # List directory contents
        for item in os.listdir(target_dir):
            item_path = os.path.join(target_dir, item)
            
            if os.path.isdir(item_path):
                # It's a folder
                folders.append({
                    "name": item,
                    "type": "folder",
                    "path": os.path.relpath(item_path, settings.MEDIA_ROOT)
                })
            else:
                # It's a file
                file_size = os.path.getsize(item_path)
                file_ext = os.path.splitext(item)[1].lower()
                relative_path = os.path.relpath(item_path, settings.MEDIA_ROOT)
                file_url = os.path.join(settings.MEDIA_URL, relative_path).replace('\\', '/')
                
                files.append({
                    "name": item,
                    "type": "file",
                    "size": file_size,
                    "extension": file_ext,
                    "path": relative_path,
                    "url": file_url
                })

        # Sort files and folders
        files.sort(key=lambda x: x['name'])
        folders.sort(key=lambda x: x['name'])

        return JsonResponse({
            "success": True,
            "data": {
                "files": files,
                "folders": folders,
                "current_path": folder_path
            }
        }, status=200)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error listing files: {str(e)}"
        }, status=500)


@csrf_exempt
def delete_user_file(request):
    """Delete a file or folder from user's directory"""
    if request.method != 'DELETE':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use DELETE."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        file_path = data.get("file_path", "").strip()

        if not file_path:
            return JsonResponse({
                "success": False,
                "message": "File path is required."
            }, status=400)

        # Ensure user folders exist
        user_dir, assets_dir = ensure_user_folders(user)

        # Build full path
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        
        # Security: ensure file is within user's directory
        full_path = os.path.normpath(full_path)
        if not full_path.startswith(user_dir):
            return JsonResponse({
                "success": False,
                "message": "Invalid file path."
            }, status=400)

        if not os.path.exists(full_path):
            return JsonResponse({
                "success": False,
                "message": "File or folder not found."
            }, status=404)

        # Delete file or folder
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
            message = "Folder deleted successfully."
        else:
            os.remove(full_path)
            message = "File deleted successfully."

        return JsonResponse({
            "success": True,
            "message": message
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data."
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error deleting file: {str(e)}"
        }, status=500)


@csrf_exempt
def create_user_script(request):
    """Create a new Python script for the user"""
    if request.method != 'POST':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use POST."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        name = data.get("name", "").strip()
        code = data.get("code", "").strip()
        description = data.get("description", "").strip()

        if not name:
            return JsonResponse({
                "success": False,
                "message": "Script name is required."
            }, status=400)

        if not code:
            return JsonResponse({
                "success": False,
                "message": "Script code is required."
            }, status=400)

        # Check if script with same name already exists for this user
        if Script.objects.filter(user=user, name=name).exists():
            return JsonResponse({
                "success": False,
                "message": "A script with this name already exists."
            }, status=400)

        # Create script
        script = Script.objects.create(
            user=user,
            name=name,
            code=code,
            description=description
        )

        return JsonResponse({
            "success": True,
            "message": "Script created successfully.",
            "data": {
                "id": script.id,
                "name": script.name,
                "code": script.code,
                "description": script.description,
                "created_at": script.created_at.isoformat(),
                "updated_at": script.updated_at.isoformat()
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data."
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error creating script: {str(e)}"
        }, status=500)


@csrf_exempt
def get_user_scripts(request):
    """Get all scripts for the authenticated user"""
    if request.method != 'GET':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use GET."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        scripts = Script.objects.filter(user=user).order_by('-updated_at')
        
        scripts_data = []
        for script in scripts:
            scripts_data.append({
                "id": script.id,
                "name": script.name,
                "code": script.code,
                "description": script.description,
                "created_at": script.created_at.isoformat(),
                "updated_at": script.updated_at.isoformat(),
                "is_public": script.is_public
            })

        return JsonResponse({
            "success": True,
            "data": scripts_data
        }, status=200)

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error fetching scripts: {str(e)}"
        }, status=500)


@csrf_exempt
def get_script_by_id(request, script_id):
    """Get a specific script by ID (public or user's own script)"""
    if request.method != 'GET':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use GET."
        }, status=405)

    try:
        script = Script.objects.get(id=script_id)
        
        # Check if user is authenticated
        user, error = validate_jwt_request(request)
        is_owner = False
        
        if not error and user:
            is_owner = script.user.id == user.id
        
        # Allow access if script is public or user is the owner
        if not script.is_public and not is_owner:
            return JsonResponse({
                "success": False,
                "message": "Script not found or access denied."
            }, status=404)

        return JsonResponse({
            "success": True,
            "data": {
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
        }, status=200)

    except Script.DoesNotExist:
        return JsonResponse({
            "success": False,
            "message": "Script not found."
        }, status=404)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error fetching script: {str(e)}"
        }, status=500)


@csrf_exempt
def update_user_script(request, script_id):
    """Update an existing script"""
    if request.method != 'PUT':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use PUT."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        script = Script.objects.get(id=script_id, user=user)
    except Script.DoesNotExist:
        return JsonResponse({
            "success": False,
            "message": "Script not found or you don't have permission to edit it."
        }, status=404)

    try:
        data = json.loads(request.body)
        name = data.get("name", "").strip()
        code = data.get("code", "").strip()
        description = data.get("description", "").strip()

        if not name:
            return JsonResponse({
                "success": False,
                "message": "Script name is required."
            }, status=400)

        if not code:
            return JsonResponse({
                "success": False,
                "message": "Script code is required."
            }, status=400)

        # Check if another script with same name exists
        if name != script.name and Script.objects.filter(user=user, name=name).exists():
            return JsonResponse({
                "success": False,
                "message": "A script with this name already exists."
            }, status=400)

        # Update script
        script.name = name
        script.code = code
        script.description = description
        script.save()

        return JsonResponse({
            "success": True,
            "message": "Script updated successfully.",
            "data": {
                "id": script.id,
                "name": script.name,
                "code": script.code,
                "description": script.description,
                "updated_at": script.updated_at.isoformat()
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON data."
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error updating script: {str(e)}"
        }, status=500)


@csrf_exempt
def delete_user_script(request, script_id):
    """Delete a script"""
    if request.method != 'DELETE':
        return JsonResponse({
            "success": False,
            "message": "Invalid request method. Use DELETE."
        }, status=405)

    # Validate user authentication
    user, error = validate_jwt_request(request)
    if error:
        return error

    try:
        script = Script.objects.get(id=script_id, user=user)
        script_name = script.name
        script.delete()

        return JsonResponse({
            "success": True,
            "message": f"Script '{script_name}' deleted successfully."
        }, status=200)

    except Script.DoesNotExist:
        return JsonResponse({
            "success": False,
            "message": "Script not found or you don't have permission to delete it."
        }, status=404)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error deleting script: {str(e)}"
        }, status=500)


