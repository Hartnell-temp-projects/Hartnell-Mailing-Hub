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

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

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

The current route requires `content`, `subject`, and at least one `to` recipient. Authentication and authorization checks still need to be added before this endpoint is used in production.

## Project structure

```text
app/
  api/
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
```

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
- Send a test message only after configuring SES and verifying the sender and recipient addresses.

## Security notes

- Never commit `.env.local`, AWS access keys, Duo client secrets, session secrets, or OAuth tokens.
- Keep server-only environment variables out of client components.
- Authentication must be enforced in API routes, not only in the user interface.
- State-changing routes such as email sending will need session validation and CSRF protection when authentication is added.
- The current localStorage-based templates, mailing lists, and sent history are suitable for prototype testing, not multi-user production storage.
