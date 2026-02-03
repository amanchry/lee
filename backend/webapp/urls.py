from django.urls import path
from webapp.views import (  # New organized views
    auth_views,
    script_views,
    file_views,
    code_execution_views,
    area_views,
    docs_views,
)
# Import legacy views from the views.py file directly (not the views package)
import importlib.util
from pathlib import Path
_views_file = Path(__file__).parent / 'views.py'
spec = importlib.util.spec_from_file_location("webapp.views_legacy", _views_file)
legacy_views = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy_views)
showHome = legacy_views.showHome
UserRegisterView = legacy_views.UserRegisterView
logoutView = legacy_views.logoutView
forgot_password = legacy_views.forgot_password

urlpatterns = [
    # Legacy views (keeping for backward compatibility)
    path("", showHome, name='home'),
    path('register/', UserRegisterView, name='register'),
    path('logout/', logoutView, name='logout'),
    path('forgot-password/', forgot_password, name='forgot-password'),
    
    # Authentication endpoints (new organized views)
    path('login/', auth_views.login_view, name='login'),
    path('send-otp/', auth_views.send_email_otp_view, name='send-otp'),
    path('verify-otp/', auth_views.verify_otp_view, name='verify-otp'),
    path('create-account/', auth_views.create_account_view, name='create-account'),
    
    # Area management endpoints (new organized views)
    path('save-draw-polygon/', area_views.save_draw_geojson, name='save-draw-polygon'),
    path('get-added-area-list/', area_views.get_added_areas_list, name='get-added-area-list'),
    path('get-area-geom/<int:areaId>', area_views.get_area_geometry, name='get-area-geom'),
    path('delete-area-geom/<int:id>', area_views.delete_area_geom, name='delete-area-geom'),
    
    # Code execution endpoints (new organized views)
    path('execute-code/', code_execution_views.execute_python_code, name='execute-code'),
    
    # File management endpoints (new organized views)
    path('upload-file/', file_views.upload_user_file, name='upload-file'),
    path('create-folder/', file_views.create_user_folder, name='create-folder'),
    path('list-files/', file_views.list_user_files, name='list-files'),
    path('delete-file/', file_views.delete_user_file, name='delete-file'),
    path('rename-file/', file_views.rename_user_file, name='rename-file'),
    path('move-file/', file_views.move_user_file, name='move-file'),
    
    # Script management endpoints (new organized views)
    path('scripts/', script_views.get_user_scripts, name='get-scripts'),
    path('scripts/create/', script_views.create_user_script, name='create-script'),
    path('scripts/<int:script_id>/', script_views.get_script_by_id, name='get-script'),
    path('scripts/<int:script_id>/update/', script_views.update_user_script, name='update-script'),
    path('scripts/<int:script_id>/delete/', script_views.delete_user_script, name='delete-script'),
    path('scripts/<int:script_id>/toggle-public/', script_views.toggle_script_public, name='toggle-script-public'),
    
    # Documentation endpoints
    path('helper-functions-docs/', docs_views.get_helper_functions_docs, name='helper-functions-docs'),
]
