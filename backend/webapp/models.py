import os
import shutil
from django.contrib.gis.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.dispatch.dispatcher import receiver
from django.core.exceptions import ValidationError
from django.utils.encoding import smart_str


# Create your models here.



def _delete(path):
    try:
        shutil.rmtree(path)
    except:
        print("Problem removing output task results directory,\n{pa}".format(pa=path))


class User(models.Model):
    """User model for authentication and user management"""
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    email = models.EmailField()
    tool = models.CharField(max_length=255, default='earthcode')
    password = models.CharField(max_length=255)
    is_active = models.BooleanField(default=False)

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")
        db_table = 'webapp_user'

    def __str__(self):
        return self.name




class OTPVerification(models.Model):
    """Model to store OTP codes for email verification"""
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)

    class Meta:
        verbose_name = _("OTP Verification")
        verbose_name_plural = _("OTP Verifications")
        ordering = ['-created_at']
        db_table = 'webapp_otpverification'

    def __str__(self):
        return f"OTP for {self.email}"

    def is_expired(self):
        return timezone.now() > self.expires_at


class Script(models.Model):
    """Model to store user Python scripts"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='scripts')
    name = models.CharField(max_length=255)
    code = models.TextField()
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_public = models.BooleanField(default=False)  # Allow sharing scripts
    
    class Meta:
        verbose_name = _("Script")
        verbose_name_plural = _("Scripts")
        ordering = ['-updated_at']
        unique_together = ['name', 'user']
        db_table = 'webapp_script'

    def __str__(self):
        return f"{self.name} ({self.user.name})"


class Area(models.Model):
    """Model for geographic areas/polygons uploaded by users"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, verbose_name=_("Area name"))
    user = models.ForeignKey('User', verbose_name=_("User uploaded the area"),
                             on_delete=models.CASCADE)
    geom = models.MultiPolygonField(srid=4326)

    class Meta:
        db_table = 'webapp_area'
        ordering = ["name"]
        verbose_name = _("Area")
        verbose_name_plural = _("Areas")
        unique_together = ['name', 'user']

    def __unicode__(self):
        return smart_str(self.name)

    def __str__(self):
        return self.__unicode__()

    def natural_key(self):
        return self.__unicode__()

    def clean(self):
        data = Area.objects.filter(user__exact=self.user).filter(name__iexact=self.name)
        if len(data) > 0:
            from django.core.exceptions import ValidationError
            raise ValidationError("The name is already existing")

    def save(self, *args, **kwargs):
        self.full_clean()
        super(Area, self).save(*args, **kwargs)


class Folder(models.Model):
    """Model to manage user folders/directories in database"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='folders')
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subfolders')
    path = models.CharField(max_length=500)  # Relative path from user directory
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Folder")
        verbose_name_plural = _("Folders")
        ordering = ['name']
        unique_together = ['name', 'user', 'parent']
        db_table = 'webapp_folder'
        indexes = [
            models.Index(fields=['user', 'parent']),
            models.Index(fields=['path']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.user.username})"
    
    def get_full_path(self):
        """Get full path including parent folders"""
        if self.parent:
            return f"{self.parent.get_full_path()}/{self.name}"
        return self.name
    
    def clean(self):
        # Validate name doesn't contain path separators
        if '/' in self.name or '\\' in self.name:
            raise ValidationError("Folder name cannot contain path separators.")
        
        # Check for duplicate name in same parent
        existing = Folder.objects.filter(user=self.user, name=self.name, parent=self.parent)
        if self.pk:
            existing = existing.exclude(pk=self.pk)
        if existing.exists():
            raise ValidationError(f"A folder with the name '{self.name}' already exists in this location.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        # Update path when saving
        if not self.path or self.path == '':
            if self.parent:
                self.path = f"{self.parent.path}/{self.name}"
            else:
                self.path = self.name
        super(Folder, self).save(*args, **kwargs)


class Asset(models.Model):
    """Model to manage user files/assets in database"""
    ASSET_TYPES = [
        ('geojson', 'GeoJSON'),
        ('geotiff', 'GeoTIFF'),
        ('csv', 'CSV'),
    ]
    
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='assets')
    name = models.CharField(max_length=255)
    folder = models.ForeignKey('Folder', on_delete=models.CASCADE, null=True, blank=True, related_name='assets')
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPES, default='other')
    file_path = models.CharField(max_length=500)  # Relative path from MEDIA_ROOT
    file_size = models.BigIntegerField(default=0)  # Size in bytes
    file_extension = models.CharField(max_length=10, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    is_geojson_in_postgis = models.BooleanField(default=False)  # True if GeoJSON is stored in PostGIS Area model
    postgis_area_id = models.IntegerField(null=True, blank=True)  # Reference to Area.id if stored in PostGIS
    metadata = models.JSONField(default=dict, blank=True)  # Store additional metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Asset")
        verbose_name_plural = _("Assets")
        ordering = ['-created_at']
        unique_together = ['name', 'user', 'folder']
        db_table = 'webapp_asset'
        indexes = [
            models.Index(fields=['user', 'folder']),
            models.Index(fields=['file_path']),
            models.Index(fields=['asset_type']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.user.username})"
    
    def get_full_path(self):
        """Get full relative path"""
        if self.folder:
            return f"{self.folder.get_full_path()}/{self.name}"
        return self.name
    
    def get_file_url(self):
        """Get file URL for serving"""
        from django.conf import settings
        return f"{settings.MEDIA_URL}{self.file_path}"
    
    def clean(self):
        # Validate name
        if not self.name or not self.name.strip():
            raise ValidationError("Asset name is required.")
        
        # Check for duplicate name in same folder
        existing = Asset.objects.filter(user=self.user, name=self.name, folder=self.folder)
        if self.pk:
            existing = existing.exclude(pk=self.pk)
        if existing.exists():
            raise ValidationError(f"An asset with the name '{self.name}' already exists in this location.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        # Update file_path when saving
        if not self.file_path or self.file_path == '':
            if self.folder:
                self.file_path = f"{self.folder.path}/{self.name}"
            else:
                self.file_path = self.name
        super(Asset, self).save(*args, **kwargs)

