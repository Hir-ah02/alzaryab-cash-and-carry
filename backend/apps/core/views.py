from django.db import connection
from django.db.utils import DatabaseError
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness and database check. Returns 503 if PostgreSQL is unreachable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        database = 'ok'
    except DatabaseError:
        database = 'unavailable'

    healthy = database == 'ok'
    return Response(
        {'status': 'ok' if healthy else 'error', 'database': database},
        status=200 if healthy else 503,
    )
