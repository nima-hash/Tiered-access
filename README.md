Tiered Content Access Application
This project demonstrates a web application that provides tiered access to content stored in Amazon S3, leveraging AWS Cognito for user authentication and authorization. Users can browse a "free" tier of content as guests, while a "premium" tier is accessible only to authenticated users.

Project Overview
The application consists of:

A static frontend hosted on an S3 bucket.

Content (free and premium) stored in a separate S3 bucket.

AWS Cognito User Pool for managing user sign-up, sign-in, and confirmation.

AWS Cognito Identity Pool for federating identities and issuing temporary AWS credentials to both authenticated and unauthenticated (guest) users.

IAM Roles to define precise S3 access permissions for each user type.

Getting Started
This project is designed to be deployed on AWS. We'll use CloudFormation to provision most of the necessary AWS resources, followed by some manual configuration steps.

1. AWS CloudFormation Deployment
The cloudformation.yaml template sets up the core AWS infrastructure.

Steps:

Download cloudformation.yaml.

Log in to your AWS Management Console.

Navigate to the CloudFormation service.

Click "Create stack" -> "With new resources (standard)".

Upload the cloudformation.yaml file.

Provide a Stack name (e.g., MyTieredContentAppStack).

Fill in the Parameters:

ProjectName: A unique identifier for your project (e.g., MyTieredContentApp).

FrontendBucketName: A globally unique name for your frontend S3 bucket (e.g., my-app-frontend-yourname-123).

ContentBucketName: A globally unique name for your content S3 bucket (e.g., my-app-content-yourname-456).

UserPoolName: A name for your Cognito User Pool (e.g., MyAppUsers).

IdentityPoolName: A name for your Cognito Identity Pool (e.g., MyAppIdentities).

Proceed through the wizard, acknowledge the IAM resource creation, and click "Create stack".

Wait for the stack to reach CREATE_COMPLETE status.

Go to the "Outputs" tab of your CloudFormation stack. Note down the values for:

FrontendBucketWebsiteUrl

UserPoolId

UserPoolClientId

IdentityPoolId

AuthenticatedRoleArn

UnauthenticatedRoleArn

ContentBucketNameOutput

2. Post-CloudFormation IAM Role Configuration
CloudFormation creates the IAM roles, but due to circular dependencies and specific Cognito requirements, some trust policy adjustments and role assignments need to be done manually.

A. Assign Default Roles in Cognito Identity Pool:
Your Identity Pool needs to know which IAM roles to assign to authenticated and unauthenticated users.

Go to the Cognito service in the AWS Console.

Navigate to "Identity pools" (under Federated Identities).

Click on the name of your Identity Pool (e.g., MyAppIdentities).

Go to the "User access" tab.

For "Authenticated access":

Find the Identity Provider associated with your User Pool (e.g., cognito-idp.YOUR_REGION.amazonaws.com/YOUR_USER_POOL_ID).

Click "Edit" next to it.

Under "Role settings," ensure "Use default role" is selected.

From the dropdown, choose the CognitoAuthenticatedRole created by your CloudFormation stack (its name includes your ProjectName).

Save changes.

For "Guest access":

Find the "Guest access" section.

Click "Edit" next to it.

Ensure "Enable access to unauthenticated identities" is checked.

From the "Default unauthenticated role" dropdown, choose the CognitoUnauthenticatedRole created by your CloudFormation stack (its name includes your ProjectName).

Save changes.

B. Verify IAM Role Trust Policies (Crucial for assuming roles):
While CloudFormation sets these, it's good practice to verify, especially if you encounter InvalidIdentityPoolConfigurationException.

Go to the IAM service in the AWS Console.

Navigate to "Roles".

Find your CognitoAuthenticatedRole:

Click on its name.

Go to the "Trust relationships" tab.

Click "Edit trust policy".

Ensure the Principal is cognito-identity.amazonaws.com and the Condition includes cognito-identity.amazonaws.com:aud matching your IdentityPoolId and cognito-identity.amazonaws.com:amr set to authenticated.

Save if any changes were needed.

Find your CognitoUnauthenticatedRole:

Click on its name.

Go to the "Trust relationships" tab.

Click "Edit trust policy".

Ensure the Principal is cognito-identity.amazonaws.com and the Condition includes cognito-identity.amazonaws.com:aud matching your IdentityPoolId and cognito-identity.amazonaws.com:amr set to unauthenticated (no leading space!).

Save if any changes were needed.

C. Verify IAM Role Permissions Policies (for S3 access):
These policies define what each role can access in S3.

While still in IAM -> Roles:

For CognitoAuthenticatedRole:

Go to the "Permissions" tab.

Confirm there's a policy allowing s3:ListBucket on your ContentBucket and s3:GetObject on ContentBucket/*.

For CognitoUnauthenticatedRole:

Go to the "Permissions" tab.

Confirm there's a policy allowing s3:GetObject on ContentBucket/free/* and s3:ListBucket on ContentBucket with a s3:prefix condition for free/* and free/.

3. Configure S3 Content Bucket CORS
Your frontend (hosted in a different S3 bucket) needs permission to fetch content from your content bucket.

Go to the S3 service in the AWS Console.

Click on the name of your Content Bucket (e.g., my-app-content-yourname-456).

Go to the "Permissions" tab.

Scroll down to "Cross-origin resource sharing (CORS)".

Click "Edit".

Paste the following JSON, replacing YOUR_FRONTEND_BUCKET_WEBSITE_URL with the FrontendBucketWebsiteUrl output from your CloudFormation stack (e.g., http://my-app-frontend-yourname-123.s3-website.YOUR_REGION.amazonaws.com):

[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET"
    ],
    "AllowedOrigins": [
      "YOUR_FRONTEND_BUCKET_WEBSITE_URL"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]

Click "Save changes".

4. Prepare S3 Content
Upload some dummy files to your ContentBucket:

Create a folder named free/ and upload a file (e.g., free/sample.txt).

Create a folder named paid/ and upload a file (e.g., paid/premium.pdf).

5. Frontend Application Setup
Update script.js:

Open the script.js file.

Replace the placeholder values at the top of the file with the actual IDs and ARNs you obtained from the CloudFormation Outputs:

YOUR_AWS_REGION

YOUR_COGNITO_USER_POOL_ID (from UserPoolId)

YOUR_COGNITO_APP_CLIENT_ID (from UserPoolClientId)

YOUR_COGNITO_IDENTITY_POOL_ID (from IdentityPoolId)

YOUR_CONTENT_BUCKET_NAME (from ContentBucketNameOutput)

Upload Frontend Files:

Upload your index.html and script.js (and any CSS you have) to your Frontend Bucket. Ensure index.html is in the root.

Usage
Open your web browser and navigate to the FrontendBucketWebsiteUrl obtained from CloudFormation.

Browse as Guest: Click "Browse as Guest" to access the free content. You should be able to list and view files from the free/ directory.

Sign Up / Sign In: Use the sign-up form to create a new user account. Confirm your account via the email you receive. Then, log in with your new credentials.

Access Premium Content: As an authenticated user, you should now be able to list and view files from both the free/ and paid/ directories.

Logout: Click "Logout" to return to the sign-in screen.

Development Notes
AI Assistance: The JavaScript logic for this application, particularly the intricate AWS SDK interactions for Cognito and S3, was developed with significant assistance from an AI model. This iterative process helped in refining the authentication flows, credential management, and error handling.

Troubleshooting: If you encounter issues, always check your browser's developer console for errors. For AWS-related errors, the error code and message are usually very descriptive and point to specific misconfigurations in IAM policies, Cognito settings, or S3 bucket policies.

Security Best Practices: This example provides functional tiered access. For production environments, consider implementing more advanced security measures such as:

Stronger password policies.

Multi-Factor Authentication (MFA).

More granular IAM permissions (e.g., per-user folders in S3).

Content Delivery Network (CDN) like CloudFront for improved performance and security.

Server-side validation for any critical operations.