export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

function formatFirestoreError(context: SecurityRuleContext, firebaseUser: any) {
  const { operation, path, requestResourceData } = context;

  const auth = firebaseUser
    ? {
        uid: firebaseUser.uid,
        token: {
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          email_verified: firebaseUser.emailVerified,
          picture: firebaseUser.photoURL,
        },
      }
    : null;

  const request = {
    auth,
    method: operation,
    path: `/databases/(default)/documents/${path}`,
    resource: requestResourceData ? { data: requestResourceData } : undefined,
  };

  const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(request, null, 2)}`;
  
  return message;
}

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;
  public originalError?: Error;

  constructor(context: SecurityRuleContext, originalError?: Error) {
    // We can't get the user object synchronously, so we will format the message later
    // when the error is handled by the listener.
    super('FirestorePermissionError: A permission error occurred.');
    this.name = 'FirestorePermissionError';
    this.context = context;
    this.originalError = originalError;
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }

  // A method to format the message with the user details
  public formatMessage(user: any): string {
    return formatFirestoreError(this.context, user);
  }
}
