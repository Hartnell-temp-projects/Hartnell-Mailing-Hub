# Hartnell Mailer

Hartnell Mailer is a Next.js application for creating and sending internal email communications through Amazon Simple Email Service (AWS SES).

The application currently supports:

- Rich-text email composition with formatting tools
- A live email preview while composing
- Pre-created and user-saved email templates
- Manual recipients and saved mailing lists
- CSV, XLSX, and XLS recipient-file imports
- A dashboard showing sent-email history, saved templates, and mailing lists
- Batched sending for larger recipient groups
- Duo Generic OIDC login through server-side authentication routes

## Requirements

- Node.js 20 or newer
- npm
- An AWS account with Amazon SES enabled
- An SES-verified sender address

During local development, the application interface can be opened without AWS credentials. Sending an email requires valid AWS credentials and a verified SES sender address.

## Local setup

1. Clone the repository and move into the project directory:

   ```bash
   git clone <repository-url>
   cd hartnell_mailer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local` in the project root. It should be next to `package.json` and must not be committed:

   ```env
   AWS_REGION=us-west-2
   SES_FROM_ADDRESS=verified-sender@example.edu
   DUO_ISSUER=https://your-duo-issuer.example/oidc/your-app-id
   DUO_CLIENT_ID=your-duo-client-id
   DUO_CLIENT_SECRET=your-duo-client-secret
   DUO_REDIRECT_URI=http://localhost:3000/api/auth/callback
   DUO_SCOPE=openid profile email
   ```

   The AWS SDK uses its normal credential-provider chain. The redirect URI must exactly match the port where the local Next.js server is running and must also be registered in Duo.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Next.js, such as [http://localhost:3000](http://localhost:3000).

## Available commands

```bash
npm run dev       # Start the local development server
npm run build     # Create a production build
npm run start     # Start the production build
npm run lint      # Run ESLint
```

## Using the application

### Compose an email

1. Open the Compose view.
2. Choose **Start from scratch** or select a built-in or saved template.
3. Enter a subject and message.
4. Use the rich-text editor to format the message with options such as:
   - Bold, italic, underline, and strikethrough
   - Bulleted and numbered lists
   - Text alignment
   - Links that open in a new tab
   - Text highlighting
   - Font-size controls
   - Headings and other text styles
   - Undo and redo
5. Add recipients manually or choose a saved mailing list.
6. Review the live preview on the right side of the compose screen.
7. Select **Send Email**.

The preview updates as the subject, recipients, and message change. The editor stores the message as HTML so that formatting can be sent through SES.

### Use and save templates

Built-in templates are loaded from [`lib/emails/test.html`](lib/emails/test.html) through `/api/email-templates`.

To save a template:

1. Create or edit a message.
2. Select **Save as template**.
3. Enter a template name.
4. Save it.

User-created templates are stored in the browser's `localStorage`. Built-in templates are not stored there and cannot be deleted from the interface. Only templates created by the user can be deleted.

### Import and save a mailing list

The mailing-list importer accepts:

- `.csv`
- `.xlsx`
- `.xls`

The importer scans the file for email-address-shaped values and removes duplicate addresses. The file does not currently require a specific column name; it extracts matching email addresses from the file contents.

To create a mailing list:

1. Open the recipient section.
2. Choose the upload option.
3. Select a CSV or spreadsheet file.
4. Review the number of addresses found.
5. Give the list a name and save it.

Saved lists are available for later messages and are stored in the browser's `localStorage`.

### Dashboard

The dashboard summarizes information stored in the current browser:

- Successful email sends and recipient totals
- Saved templates
- Saved mailing lists and their recipient counts

This data is currently browser-local. It is not shared between browsers, computers, or users, and it is not yet backed by a database.

## Browser storage

The current prototype uses these `localStorage` keys:

| Key | Contents |
| --- | --- |
| `hartnell-mailer-saved-templates` | Templates created by the user |
| `hartnell-mailer-saved-lists` | Mailing lists uploaded and saved by the user |
| `hartnell-mailer-sent-emails` | Successful-send history shown on the dashboard |

To clear test data, open the browser developer console and run only the key you want to remove:

```js
localStorage.removeItem("hartnell-mailer-saved-templates");
localStorage.removeItem("hartnell-mailer-saved-lists");
localStorage.removeItem("hartnell-mailer-sent-emails");
```

Refreshing the page after clearing a key will update the interface. This removes only data stored in that browser; it does not delete files from the repository.

## API routes

### `GET /api/email-templates`

Returns the built-in email templates, including the template loaded from `lib/emails/test.html`.

### `POST /api/send-email`

Sends an email through AWS SES. The request body contains:

```json
{
  "content": "<p>Email content</p>",
  "subject": "Example subject",
  "to": ["recipient@example.edu"],
  "cc": [],
  "bcc": []
}
```

The current route requires an authenticated Duo session, as well as `content`, `subject`, and at least one `to` recipient. It returns `401 Unauthorized` when no authenticated session is present.

### Authentication routes

| Route | Purpose |
| --- | --- |
| `GET /api/auth/login` | Starts the Duo Authorization Code + PKCE flow. |
| `GET /api/auth/callback` | Validates Duo's callback and creates the application session. |
| `GET /api/auth/session` | Returns safe information about the current signed-in user. |
| `POST /api/auth/logout` | Removes the current application session. |

Logging out redirects the user to `/login` with a confirmation message and a new **Log in with Duo** button.

## Project structure

```text
app/
  api/
    auth/                   Duo login, callback, session, and logout routes
    email-templates/       Built-in template API route
    send-email/            AWS SES send route
  page.tsx                 Main client-side application page
  globals.css              Global styles

components/
  ComposeForm.tsx          Email composition workflow
  Dashboard.tsx            User dashboard
  EmailPreview.tsx         Live email preview
  Header.tsx               Application header and navigation
  MessageEditor.tsx        Rich-text email editor
  TemplateChooser.tsx      Blank and template starting choices
  recipients/              Manual and uploaded recipient controls
  types.ts                 Shared TypeScript types

lib/
  emails/test.html         Built-in test email template
  parseRecipientFile.ts    CSV/XLS/XLSX email extraction
  recipientLists.ts        Predefined recipient-group definitions
  storageKeys.ts           Browser-storage key constants

lib/auth/
  config.ts                Duo OIDC discovery and environment configuration
  session.ts               Server-side sessions and OIDC transactions
```

## Duo OIDC authentication

The application uses [`openid-client`](https://github.com/panva/openid-client) on the server with Duo's Generic OIDC integration. The browser is redirected to Duo when the user selects **Log in with Duo**. After successful authentication, the callback route stores the Duo tokens in a server-side session and gives the browser an `HttpOnly` session cookie.

The browser does not receive or store the Duo access or refresh tokens. The current prototype stores sessions in the Next.js process memory, which is appropriate for local testing. A shared session store such as Redis is required before deploying multiple application instances or relying on sessions across restarts.

The Duo administrator must register the exact local callback URL, for example:

```text
http://localhost:3000/api/auth/callback
```

Use the port printed by `npm run dev`. Production should use the deployed HTTPS callback URL instead.

## Testing checklist

### Interface testing

- Start the app with `npm run dev`.
- Confirm that the compose screen loads.
- Confirm that the preview changes when the subject or message changes.
- Test rich-text formatting and verify the formatting appears in the preview.
- Choose the built-in template and confirm that its content loads.
- Save a template, refresh the page, and confirm that it remains available.
- Delete the saved template and confirm that the built-in template remains.
- Upload a CSV with several email addresses and save the resulting list.
- Refresh the page and confirm that the mailing list appears on the dashboard.
- Select **Log in with Duo** and confirm that Duo redirects back to the callback URL.
- Confirm that the header shows the signed-in user and a logout button.
- Confirm that sending an email while signed out returns an authentication error.
- Sign in again and confirm that the send request is allowed to reach AWS SES.
- Send a test message only after configuring SES and verifying the sender and recipient addresses.

## Security notes

- Never commit `.env.local`, AWS access keys, Duo client secrets, session secrets, or OAuth tokens.
- Keep server-only environment variables out of client components.
- Authentication is enforced in API routes, not only in the user interface.
- The current server-side session store is in-memory and must be replaced with a shared store before production deployment.
- State-changing routes such as email sending should receive CSRF protection and additional authorization rules before production use.
- The current localStorage-based templates, mailing lists, and sent history are suitable for prototype testing, not multi-user production storage.
