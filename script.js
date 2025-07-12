const AWS_REGION = 'YOUR_REGION';
const USER_POOL_ID = 'COGNITO_USER_POOL_ID';
const CLIENT_ID = 'COGNITO_USER_CLIENT_ID';
const IDENTITY_POOL_ID = 'COGNITO_IDENTITY_POOL_ID';

AWS.config.region = AWS_REGION;
AWS.config.credentials = null;

const poolData = {
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);


function createS3Client() {
    return new AWS.S3({
        apiVersion: '2006-03-01',
        params: { Bucket: 'YOUR_CONTENT_BUCKET_NAME' }
    });
}


const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmCodeInput = document.getElementById('confirm-code');

const authSection = document.getElementById('auth-section');
const confirmSection = document.getElementById('confirm-section');
const contentSection = document.getElementById('content-section');
const premiumSection = document.getElementById('premium-section');

const authMessage = document.getElementById('auth-message');
const confirmMessage = document.getElementById('confirm-message');
const configWarning = document.getElementById('config-warning');

const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const confirmBtn = document.getElementById('confirm-btn');
const logoutBtn = document.getElementById('logout-btn');
const guestLoginBtn = document.getElementById('guest-login-btn');

const userInfoSpan = document.getElementById('user-info');
const listFreeBtn = document.getElementById('list-free-btn');
const freeFilesList = document.getElementById('free-files-list');
const listPremiumBtn = document.getElementById('list-premium-btn');
const premiumFilesList = document.getElementById('premium-files-list');

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `alert mt-3 alert-${type}`;
    element.classList.remove('d-none');
}

function hideMessage(element) {
    element.classList.add('d-none');
}

function showSection(sectionToShow) {
    [authSection, confirmSection, contentSection].forEach(section => {
        if (section) {
            section.classList.add('d-none');
        }
    });
    if (sectionToShow) {
        sectionToShow.classList.remove('d-none');
    }
}

async function signUp() {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage(authMessage, 'Please enter email and password.', 'danger');
        return;
    }

    try {
        const attributeList = [
            new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })
        ];

        await new Promise((resolve, reject) => {
            userPool.signUp(email, password, attributeList, null, (err, result) => {
                if (err) {
                    console.error('Signup error:', err);
                    reject(err);
                    return;
                }
                console.log('User signed up:', result.user);
                resolve(result);
            });
        });

        showMessage(authMessage, 'Sign up successful! Please check your email for a confirmation code.', 'success');
        showSection(confirmSection);

    } catch (error) {
        showMessage(authMessage, `Sign up failed: ${error.message || error}`, 'danger');
    }
}

async function confirmSignUp() {
    const email = emailInput.value;
    const confirmationCode = confirmCodeInput.value;

    if (!email || !confirmationCode) {
        showMessage(confirmMessage, 'Please enter email and confirmation code.', 'danger');
        return;
    }

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
    });

    try {
        await new Promise((resolve, reject) => {
            cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
                if (err) {
                    console.error('Confirmation error:', err);
                    reject(err);
                    return;
                }
                console.log('Account confirmed:', result);
                resolve(result);
            });
        });

        showMessage(confirmMessage, 'Account confirmed successfully! You can now log in.', 'success');
        setTimeout(() => {
            resetToLoginScreen();
        }, 3000);

    } catch (error) {
        showMessage(confirmMessage, `Confirmation failed: ${error.message || error}`, 'danger');
    }
}

async function signIn() {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage(authMessage, 'Please enter email and password.', 'danger');
        return;
    }

    const authenticationData = {
        Username: email,
        Password: password,
    };
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
    });

    try {
        const session = await new Promise((resolve, reject) => {
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (session) => {
                    console.log('User logged in:', session);
                    resolve(session);
                },
                onFailure: (err) => {
                    console.error('Login error:', err);
                    reject(err);
                },
                newPasswordRequired: (userAttributes, requiredAttributes) => {
                    console.warn('New password required:', userAttributes, requiredAttributes);
                    reject(new Error('New password required. Please reset your password.'));
                }
            });
        });

        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: IDENTITY_POOL_ID,
            Logins: {
                [`cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`]: session.getIdToken().getJwtToken()
            }
        });
        await AWS.config.credentials.getPromise();

        showMessage(authMessage, 'Login successful!', 'success');
        updateUIBasedOnAuthStatus();

    } catch (error) {
        showMessage(authMessage, `Login failed: ${error.message || error}`, 'danger');
        resetToLoginScreen();
    }
}

async function guestLogin() {
    console.log('Attempting guest login...');
    try {
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.signOut();
            console.log('Previous authenticated user signed out.');
        }
        localStorage.removeItem(`aws.cognito.identity-id.${IDENTITY_POOL_ID}`);
        localStorage.removeItem(`aws.cognito.lastAuthUser.${IDENTITY_POOL_ID}`);

        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: IDENTITY_POOL_ID
        });
        await AWS.config.credentials.getPromise();

        showMessage(authMessage, 'Browse as guest. Access to free content only.', 'info');
        updateUIBasedOnAuthStatus();
    } catch (error) {
        console.error('Guest login failed:', error);
        showMessage(authMessage, `Guest access failed: ${error.message || error}`, 'danger');
        resetToLoginScreen();
    }
}

async function logout() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
        cognitoUser.signOut();
        console.log('Authenticated user signed out.');
    }
    showMessage(authMessage, 'You have been logged out.', 'info');
    resetToLoginScreen();
}

function getCognitoUserSession() {
    const cognitoUser = userPool.getCurrentUser();
    return new Promise((resolve, reject) => {
        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(session);
            });
        } else {
            resolve(null);
        }
    });
}

async function updateUIBasedOnAuthStatus() {
    const session = await getCognitoUserSession();
    const cognitoUser = userPool.getCurrentUser();

    if (session && cognitoUser) {
        console.log('User is authenticated via User Pool.');
        userInfoSpan.textContent = `Logged in as: ${cognitoUser.getUsername()}`;
        showSection(contentSection);
        premiumSection.classList.remove('d-none');
        hideMessage(authMessage);
        hideMessage(confirmMessage);

        if (!AWS.config.credentials || !AWS.config.credentials.accessKeyId || AWS.config.credentials.params.Logins === undefined) {
             AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: IDENTITY_POOL_ID,
                Logins: {
                    [`cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`]: session.getIdToken().getJwtToken()
                }
            });
        }
        try {
            await AWS.config.credentials.getPromise();
            console.log("Authenticated credentials refreshed.");
        } catch (error) {
            console.error('Error refreshing authenticated credentials:', error);
            resetToLoginScreen();
            return;
        }

    } else {
        console.log('No User Pool session. Attempting to get unauthenticated credentials...');

        if (!AWS.config.credentials || !AWS.config.credentials.accessKeyId) {
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({ IdentityPoolId: IDENTITY_POOL_ID });
        }

        try {
            await AWS.config.credentials.getPromise();
            if (AWS.config.credentials.accessKeyId) {
                console.log('Unauthenticated (Guest) credentials obtained successfully.');
                userInfoSpan.textContent = 'Browse as Guest';
                showSection(contentSection);
                premiumSection.classList.add('d-none');
                hideMessage(authMessage);
                hideMessage(confirmMessage);
            } else {
                console.warn('getPromise succeeded but no accessKeyId. Resetting to login.');
                resetToLoginScreen();
            }
        } catch (error) {
            console.error('Failed to get any credentials (unauthenticated or otherwise):', error);
            resetToLoginScreen();
        }
    }
}

async function resetToLoginScreen() {
    console.log("Resetting to login screen (clearing all credentials).");
    localStorage.removeItem(`aws.cognito.identity-id.${IDENTITY_POOL_ID}`);
    localStorage.removeItem(`aws.cognito.lastAuthUser.${IDENTITY_POOL_ID}`);

    AWS.config.credentials = null;

    showSection(authSection);
    emailInput.value = '';
    passwordInput.value = '';
    userInfoSpan.textContent = '';
    premiumSection.classList.add('d-none');
    hideMessage(authMessage);
    hideMessage(confirmMessage);
}

async function listFiles(prefix, elementToListIn) {
    elementToListIn.innerHTML = 'Loading files...';
    try {
        if (!AWS.config.credentials || !AWS.config.credentials.accessKeyId) {
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({ IdentityPoolId: IDENTITY_POOL_ID });
        }
        await AWS.config.credentials.getPromise();

        const s3 = createS3Client();
        const data = await s3.listObjectsV2({ Prefix: prefix }).promise();
        elementToListIn.innerHTML = '';

        if (data.Contents.length === 0 || (data.Contents.length === 1 && data.Contents[0].Key === prefix)) {
            elementToListIn.innerHTML = '<p>No files found.</p>';
            return;
        }

        data.Contents.forEach(obj => {
            if (obj.Key === prefix || obj.Key.endsWith('/')) {
                return;
            }

            const fileUrl = s3.getSignedUrl('getObject', { Key: obj.Key });
            const fileName = obj.Key.split('/').pop();

            const fileItem = document.createElement('a');
            fileItem.href = fileUrl;
            fileItem.target = '_blank';
            fileItem.textContent = fileName;
            fileItem.classList.add('list-group-item', 'list-group-item-action');
            elementToListIn.appendChild(fileItem);
        });
    } catch (error) {
        console.error(`Error listing files from ${prefix}:`, error);
        elementToListIn.innerHTML = `<p class="text-danger">Failed to load files: ${error.message}</p>`;
        if (error.code === 'AccessDenied') {
            console.warn('Access Denied for S3. User might not have permission or session expired. Resetting to login.');
            showMessage(authMessage, 'Access Denied. Please log in or refresh for full access.', 'danger');
            resetToLoginScreen();
        }
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    if (USER_POOL_ID.includes('YOUR_') || CLIENT_ID.includes('YOUR_') || IDENTITY_POOL_ID.includes('YOUR_')) {
        if (configWarning) {
            configWarning.classList.remove('d-none');
        }
        console.error("Cognito configuration is incomplete. Please update script.js with your actual IDs.");
        return;
    } else {
        if (configWarning) {
            configWarning.classList.add('d-none');
        }
    }

    await updateUIBasedOnAuthStatus();

    if (signupBtn) signupBtn.addEventListener('click', signUp);
    if (loginBtn) loginBtn.addEventListener('click', signIn);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmSignUp);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (guestLoginBtn) guestLoginBtn.addEventListener('click', guestLogin);

    if (listFreeBtn) {
        listFreeBtn.addEventListener('click', async () => {
            await listFiles('free/', freeFilesList);
        });
    }

    if (listPremiumBtn) {
        listPremiumBtn.addEventListener('click', async () => {
            await listFiles('paid/', premiumFilesList);
        });
    }
});
