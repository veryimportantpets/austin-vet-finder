"""
Storage adapters for file uploads.
Supports local storage and Google Drive.
"""
import os
import mimetypes
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, BinaryIO, Dict, Any
from django.conf import settings


@dataclass
class StorageFileRef:
    """Reference to a stored file."""
    id: str
    url: str
    filename: str
    size: int
    mime_type: str
    meta: Dict[str, Any]


class StorageAdapter(ABC):
    """Abstract base class for storage adapters."""

    @abstractmethod
    def save_file(self, project_id: int, filename: str, file_data: BinaryIO,
                  mime_type: str = '', subfolder: str = '') -> StorageFileRef:
        """Save a file and return a reference."""
        pass

    @abstractmethod
    def get_download_url(self, attachment) -> str:
        """Get a URL to download the file."""
        pass

    @abstractmethod
    def list_files(self, project_id: int, subfolder: str = '') -> list:
        """List files in a project folder."""
        pass

    @abstractmethod
    def delete_file(self, file_ref: StorageFileRef) -> bool:
        """Delete a file."""
        pass


class LocalStorageAdapter(StorageAdapter):
    """Store files locally in the media directory."""

    def __init__(self):
        self.base_path = settings.MEDIA_ROOT

    def _get_project_path(self, project_id: int, subfolder: str = '') -> str:
        path = os.path.join(self.base_path, str(project_id))
        if subfolder:
            path = os.path.join(path, subfolder)
        os.makedirs(path, exist_ok=True)
        return path

    def save_file(self, project_id: int, filename: str, file_data: BinaryIO,
                  mime_type: str = '', subfolder: str = '') -> StorageFileRef:
        folder_path = self._get_project_path(project_id, subfolder)

        # Ensure unique filename
        base, ext = os.path.splitext(filename)
        final_filename = filename
        counter = 1
        while os.path.exists(os.path.join(folder_path, final_filename)):
            final_filename = f"{base}_{counter}{ext}"
            counter += 1

        file_path = os.path.join(folder_path, final_filename)

        # Write file
        with open(file_path, 'wb') as f:
            if hasattr(file_data, 'chunks'):
                for chunk in file_data.chunks():
                    f.write(chunk)
            else:
                f.write(file_data.read())

        file_size = os.path.getsize(file_path)
        if not mime_type:
            mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        relative_path = os.path.join(str(project_id), subfolder, final_filename) if subfolder else os.path.join(str(project_id), final_filename)

        return StorageFileRef(
            id=relative_path,
            url=f"{settings.MEDIA_URL}{relative_path}",
            filename=final_filename,
            size=file_size,
            mime_type=mime_type,
            meta={'storage': 'local', 'path': file_path}
        )

    def get_download_url(self, attachment) -> str:
        if attachment.file_url:
            return attachment.file_url
        return f"{settings.MEDIA_URL}{attachment.file_path}"

    def list_files(self, project_id: int, subfolder: str = '') -> list:
        folder_path = self._get_project_path(project_id, subfolder)
        files = []
        if os.path.exists(folder_path):
            for filename in os.listdir(folder_path):
                filepath = os.path.join(folder_path, filename)
                if os.path.isfile(filepath):
                    files.append({
                        'filename': filename,
                        'size': os.path.getsize(filepath),
                        'path': filepath
                    })
        return files

    def delete_file(self, file_ref: StorageFileRef) -> bool:
        try:
            path = file_ref.meta.get('path') or os.path.join(self.base_path, file_ref.id)
            if os.path.exists(path):
                os.remove(path)
                return True
        except Exception:
            pass
        return False


class GoogleDriveAdapter(StorageAdapter):
    """Store files in Google Drive using a service account."""

    def __init__(self):
        self.service = None
        self._init_service()

    def _init_service(self):
        """Initialize the Google Drive API service."""
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        json_path = settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_PATH
        if not json_path or not os.path.exists(json_path):
            raise ValueError("Google Drive service account JSON not configured")

        credentials = service_account.Credentials.from_service_account_file(
            json_path,
            scopes=['https://www.googleapis.com/auth/drive']
        )
        self.service = build('drive', 'v3', credentials=credentials)
        self.root_folder_id = settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
        self.shared_drive_id = settings.GOOGLE_DRIVE_SHARED_DRIVE_ID

    def _get_or_create_project_folder(self, project_id: int) -> str:
        """Get or create a folder for the project."""
        from projects.models import Project

        project = Project.objects.get(pk=project_id)
        if project.drive_folder_id:
            return project.drive_folder_id

        # Create folder
        folder_name = f"Project {project_id} - {project.name}"
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
        }

        if self.root_folder_id:
            file_metadata['parents'] = [self.root_folder_id]
        elif self.shared_drive_id:
            file_metadata['parents'] = [self.shared_drive_id]

        kwargs = {}
        if self.shared_drive_id:
            kwargs['supportsAllDrives'] = True

        folder = self.service.files().create(
            body=file_metadata,
            fields='id',
            **kwargs
        ).execute()

        project.drive_folder_id = folder['id']
        project.save(update_fields=['drive_folder_id'])

        return folder['id']

    def save_file(self, project_id: int, filename: str, file_data: BinaryIO,
                  mime_type: str = '', subfolder: str = '') -> StorageFileRef:
        from googleapiclient.http import MediaIoBaseUpload
        import io

        folder_id = self._get_or_create_project_folder(project_id)

        if not mime_type:
            mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        # Read file data
        if hasattr(file_data, 'read'):
            content = file_data.read()
        else:
            content = file_data

        media = MediaIoBaseUpload(
            io.BytesIO(content),
            mimetype=mime_type,
            resumable=True
        )

        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }

        kwargs = {'media_body': media, 'body': file_metadata, 'fields': 'id,name,size,webViewLink'}
        if self.shared_drive_id:
            kwargs['supportsAllDrives'] = True

        file = self.service.files().create(**kwargs).execute()

        return StorageFileRef(
            id=file['id'],
            url=file.get('webViewLink', ''),
            filename=filename,
            size=len(content),
            mime_type=mime_type,
            meta={'storage': 'gdrive', 'drive_id': file['id']}
        )

    def get_download_url(self, attachment) -> str:
        if attachment.file_url:
            return attachment.file_url

        # Try to get fresh URL from Drive
        try:
            drive_id = attachment.storage_ref.get('drive_id') or attachment.file_path
            kwargs = {'fileId': drive_id, 'fields': 'webViewLink'}
            if self.shared_drive_id:
                kwargs['supportsAllDrives'] = True
            file = self.service.files().get(**kwargs).execute()
            return file.get('webViewLink', '')
        except Exception:
            return ''

    def list_files(self, project_id: int, subfolder: str = '') -> list:
        folder_id = self._get_or_create_project_folder(project_id)

        query = f"'{folder_id}' in parents and trashed = false"
        kwargs = {'q': query, 'fields': 'files(id,name,size,webViewLink)'}
        if self.shared_drive_id:
            kwargs['supportsAllDrives'] = True
            kwargs['includeItemsFromAllDrives'] = True

        results = self.service.files().list(**kwargs).execute()

        return [{
            'filename': f['name'],
            'size': f.get('size', 0),
            'url': f.get('webViewLink', ''),
            'drive_id': f['id']
        } for f in results.get('files', [])]

    def delete_file(self, file_ref: StorageFileRef) -> bool:
        try:
            drive_id = file_ref.meta.get('drive_id') or file_ref.id
            kwargs = {'fileId': drive_id}
            if self.shared_drive_id:
                kwargs['supportsAllDrives'] = True
            self.service.files().delete(**kwargs).execute()
            return True
        except Exception:
            return False


def get_storage_adapter() -> StorageAdapter:
    """Get the configured storage adapter."""
    backend = settings.STORAGE_BACKEND

    if backend == 'gdrive':
        try:
            return GoogleDriveAdapter()
        except Exception as e:
            # Fall back to local if Drive not configured
            import logging
            logging.warning(f"Google Drive not available, falling back to local: {e}")
            return LocalStorageAdapter()

    return LocalStorageAdapter()
