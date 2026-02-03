from django.contrib import admin
from .models import User, Area, OTPVerification, Script, Folder, Asset
from django.db.models import OuterRef, Subquery
# Register your models here.



admin.site.site_header = "WebApp Admin Panel"
admin.site.site_title = "WebApp Admin"
admin.site.index_title = "Welcome to the WebApp Admin Dashboard"


@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email','tool','username','is_active')
    search_fields = ('name', 'tool','email')
    ordering = ('id',)





@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'user_name',
        'user_username',
        'user_email',
        'user_tool',
        'geometry_type',
        'bounds_display',
        'area_size_km2',
        'related_asset',
    )

    search_fields = ('name', 'user__name', 'user__email', 'user__username', 'user__tool')
    list_filter = ('user__tool',)
    readonly_fields = (
        'id',
        'geometry_type',
        'bounds_display',
        'area_size_km2',
        'perimeter_km',
        'centroid',
        'geometry_wkt',
        'related_asset',
        'related_asset_metadata',
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'user')
        }),
        ('Geometry Information', {
            'fields': ('geom', 'geometry_type', 'bounds_display', 'centroid', 'area_size_km2', 'perimeter_km')
        }),
        ('Geometry Details', {
            'fields': ('geometry_wkt',),
            'classes': ('collapse',)
        }),
        ('Related Asset', {
            'fields': ('related_asset', 'related_asset_metadata'),
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('user')
        if request.user.is_superuser:
            return qs
        return qs.filter(user=request.user)

    # --- User columns ---
    def user_name(self, obj):
        return obj.user.name
    user_name.short_description = "User Name"
    user_name.admin_order_field = 'user__name'

    def user_username(self, obj):
        return obj.user.username
    user_username.short_description = "Username"
    user_username.admin_order_field = 'user__username'

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "Email"
    user_email.admin_order_field = 'user__email'

    def user_tool(self, obj):
        return obj.user.tool
    user_tool.short_description = "Tool"
    user_tool.admin_order_field = 'user__tool'

    # --- Geometry columns ---
    def geometry_type(self, obj):
        """Get geometry type"""
        if obj.geom:
            geom_type = obj.geom.geom_type
            num_geoms = obj.geom.num_geom if hasattr(obj.geom, 'num_geom') else 1
            return f"{geom_type} ({num_geoms} geometries)"
        return "N/A"
    geometry_type.short_description = "Geometry Type"

    def bounds_display(self, obj):
        """Display bounds/extent"""
        if obj.geom:
            extent = obj.geom.extent  # Returns (minx, miny, maxx, maxy)
            return f"[{extent[0]:.6f}, {extent[1]:.6f}, {extent[2]:.6f}, {extent[3]:.6f}]"
        return "N/A"
    bounds_display.short_description = "Bounds (minx, miny, maxx, maxy)"

    def area_size_km2(self, obj):
        """Calculate area in square kilometers"""
        if obj.geom:
            try:
                from django.contrib.gis.geos import GEOSGeometry
                from django.contrib.gis import geos
                # Transform to a projected CRS for accurate area calculation (e.g., EPSG:3857 or EPSG:3395)
                # Using EPSG:3395 (World Mercator) for area calculation
                geom_3857 = obj.geom.transform(3395, clone=True)
                area_m2 = geom_3857.area
                area_km2 = area_m2 / 1_000_000
                return f"{area_km2:.4f} km²"
            except Exception as e:
                return f"Error: {str(e)}"
        return "N/A"
    area_size_km2.short_description = "Area"

    def perimeter_km(self, obj):
        """Calculate perimeter in kilometers"""
        if obj.geom:
            try:
                from django.contrib.gis.geos import GEOSGeometry
                # Transform to EPSG:3395 for accurate length calculation
                geom_3857 = obj.geom.transform(3395, clone=True)
                perimeter_m = geom_3857.length
                perimeter_km = perimeter_m / 1000
                return f"{perimeter_km:.4f} km"
            except Exception as e:
                return f"Error: {str(e)}"
        return "N/A"
    perimeter_km.short_description = "Perimeter"

    def centroid(self, obj):
        """Get centroid coordinates"""
        if obj.geom:
            try:
                centroid = obj.geom.centroid
                return f"({centroid.x:.6f}, {centroid.y:.6f})"
            except Exception as e:
                return f"Error: {str(e)}"
        return "N/A"
    centroid.short_description = "Centroid (lon, lat)"

    def geometry_wkt(self, obj):
        """Display geometry as WKT"""
        if obj.geom:
            return obj.geom.wkt[:500] + "..." if len(obj.geom.wkt) > 500 else obj.geom.wkt
        return "N/A"
    geometry_wkt.short_description = "Geometry (WKT)"

    def related_asset(self, obj):
        """Get related Asset if exists"""
        try:
            from .models import Asset
            asset = Asset.objects.filter(postgis_area_id=obj.id, user=obj.user).first()
            if asset:
                return f"{asset.name} ({asset.asset_type})"
            return "No related asset"
        except Exception:
            return "N/A"
    related_asset.short_description = "Related Asset"

    def related_asset_metadata(self, obj):
        """Display metadata from related Asset"""
        try:
            from .models import Asset
            import json
            asset = Asset.objects.filter(postgis_area_id=obj.id, user=obj.user).first()
            if asset and asset.metadata:
                return json.dumps(asset.metadata, indent=2)
            return "No metadata available"
        except Exception as e:
            return f"Error: {str(e)}"
    related_asset_metadata.short_description = "Asset Metadata"


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ('email', 'otp', 'created_at', 'expires_at', 'is_verified', 'is_used')
    search_fields = ('email',)
    list_filter = ('is_verified', 'is_used', 'created_at')
    readonly_fields = ('created_at', 'expires_at')
    ordering = ('-created_at',)


@admin.register(Script)
class ScriptAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'updated_at', 'is_public')
    search_fields = ('name', 'user__name', 'user__email')
    list_filter = ('is_public', 'created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-updated_at',)


@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'user', 'parent', 'path', 'created_at']
    list_filter = ['user', 'created_at']
    search_fields = ['name', 'user__username', 'path']
    raw_id_fields = ['user', 'parent']


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'user', 'folder', 'asset_type', 'file_size', 'is_geojson_in_postgis', 'created_at']
    list_filter = ['user', 'asset_type', 'is_geojson_in_postgis', 'created_at']
    search_fields = ['name', 'user__username', 'file_path']
    raw_id_fields = ['user', 'folder']
    readonly_fields = ['file_size', 'created_at', 'updated_at']

    
