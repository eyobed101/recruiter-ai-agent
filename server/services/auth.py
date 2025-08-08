import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        
        # Verify the token is from Google Sign-In
        provider = decoded_token.get('firebase', {}).get('sign_in_provider')
        if provider != 'google.com':
            raise HTTPException(
                status_code=403,
                detail="Only Google Sign-In is allowed"
            )
            
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=403, detail="Invalid authentication token")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=403, detail="Expired authentication token")
    except Exception as e:
        raise HTTPException(status_code=403, detail="Authentication failed")