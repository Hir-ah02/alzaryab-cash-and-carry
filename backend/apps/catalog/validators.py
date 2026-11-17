from django.conf import settings
from django.template.defaultfilters import filesizeformat
from rest_framework.exceptions import ValidationError

# Pillow format name -> allowed file extensions (matches the admin portal: JPG, PNG, WEBP).
ALLOWED_IMAGE_FORMATS = {
    'JPEG': {'.jpg', '.jpeg'},
    'PNG': {'.png'},
    'WEBP': {'.webp'},
}


def validate_product_image(file):
    """
    Checks size, the real image format (read by Pillow, not the file name)
    and that the extension matches that format.
    """
    max_bytes = settings.PRODUCT_IMAGE_MAX_BYTES
    if file.size > max_bytes:
        raise ValidationError(f'Image is larger than {filesizeformat(max_bytes)}. Please choose a smaller file.')

    # Set by DRF's ImageField after Pillow has verified the file.
    image_format = getattr(getattr(file, 'image', None), 'format', None)
    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError('Unsupported file type. Please upload a JPG, PNG or WEBP image.')

    extension = '.' + file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
    if extension not in ALLOWED_IMAGE_FORMATS[image_format]:
        raise ValidationError('The file extension does not match the image type.')
