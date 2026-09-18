# AIV Support Ticket System
## Functional & Technical Specification for Bolt.ai

**Document version:** 1.0  
**Date:** 20 August 2026  
**Audience:** AIV Product Team, Engineering Team, Bolt.ai  
**Purpose:** Build a production-ready customer support ticketing system for AIV.

---

## 1. Executive Summary

AIV requires a dedicated support ticketing application where AIV customers can activate a support account, submit and track support tickets, communicate with AIV support agents, and receive service according to the support plan/SLA assigned to their company.

The support system is **not an e-commerce or payment system**. Purchase, billing, checkout and payment processing remain on the AIVHUB website or other external commercial systems. The support application only receives the information required to provision and operate support access.

Support accounts can be created in two ways:

1. **Automatically from AIVHUB** through a secure provisioning API/integration.
2. **Manually by an AIV administrator** for customers, partners, POCs, complimentary support users, offline-agreement customers, or other approved users.

After a support user is created, the user must receive an account activation email. The preferred approach is a secure, one-time activation link through which the user creates their own password. If AIV requires temporary passwords, the system may support a single-use temporary password with mandatory password change on first login.

When a customer creates a support ticket, the system must calculate and snapshot the correct SLA, route the ticket to the correct support team, notify the relevant agents and manager, send an automatic acknowledgement to the customer within a configurable 5-15 minute period, monitor SLA consumption, escalate tickets at risk of breach, preserve a complete audit history, and provide dashboards and reports for customers, agents and managers.

---

# 2. Scope

## 2.1 In Scope

The system must include:

- Customer/company account management.
- Customer support-user management.
- Manual support-user/account creation by AIV administrators.
- AIVHUB-to-support-system account provisioning API.
- Account activation and password setup.
- Authentication and role-based access control.
- Support plans and configurable SLA rules.
- Business hours, timezone and holiday calendars.
- Support teams, agents, managers and account-manager assignment.
- Ticket creation, assignment, categorisation and prioritisation.
- Public ticket replies and private/internal notes.
- Attachments.
- Automatic ticket acknowledgement emails.
- Agent/team/manager notifications.
- First-response and resolution SLA tracking.
- SLA pause/resume logic.
- SLA warnings and escalation.
- Ticket resolution, closure and reopening.
- Customer, agent, manager and administration dashboards.
- Search and filtering.
- Email templates and in-app notifications.
- Audit logs and ticket history.
- Reporting and exports.
- Security, data isolation and operational controls.

## 2.2 Explicitly Out of Scope

Bolt must **not** build the following inside this support application:

- Payment collection.
- Checkout pages.
- Stripe/PayPal/card processing.
- Pricing calculations.
- Invoicing.
- Refund processing.
- Payment failure workflows.
- Tax/VAT calculations.
- Product purchase workflows.
- Shopping cart.

If commercial status changes on AIVHUB, AIVHUB may send an account/support-entitlement update to this support system. The support system processes only the entitlement/access information, not the financial transaction.

---

# 3. Design Principles

Bolt must follow these principles throughout the implementation.

1. **Multi-tenant by company/account.** Every customer user belongs to an account/company.
2. **Strict account isolation.** Customer A must never be able to access Customer B's data.
3. **SLA rules must be configurable.** Do not hard-code contractual SLA durations.
4. **Each ticket receives an SLA snapshot at creation.** Later plan changes must not silently rewrite historic SLA commitments.
5. **Automatic acknowledgement is not a human first response.** It must never stop the first-response SLA clock.
6. **All significant actions must be auditable.**
7. **Emails are event notifications, not the system of record.** Tickets and their timeline remain authoritative.
8. **Manual provisioning and AIVHUB provisioning are equal first-class flows.**
9. **No customer-facing access is granted solely by frontend checks.** Permissions must be enforced server-side.
10. **Operational settings should be configurable in Admin UI rather than requiring code changes.**

---

# 4. High-Level System Context

```text
AIVHUB Website
     |
     | Secure Support Provisioning API
     v
AIV Support Ticket System
     |
     +-- Customer Accounts & Users
     +-- Authentication
     +-- Support Plans / SLA Policies
     +-- Tickets / Messages / Attachments
     +-- Routing / Assignment
     +-- SLA Engine
     +-- Notifications / Email
     +-- Dashboards / Reports
     +-- Audit Logs

AIV Admin
     |
     +-- Manual Account/User Provisioning
     +-- Plan/SLA Assignment
     +-- Team/Manager Assignment
```

No payment information is required or stored by the support system.

---

# 5. User Roles and Permissions

## 5.1 Customer User

Can:

- Log in after activation.
- Create a ticket.
- View tickets they are permitted to see.
- Reply to tickets.
- Upload attachments.
- View ticket status, priority and public history.
- Reopen eligible resolved tickets.
- Update their own profile/password.

Cannot:

- View internal notes.
- View internal escalation details.
- View tickets belonging to another company.
- Change SLA policy.
- Assign internal agents.

## 5.2 Customer Admin

Includes all Customer User permissions plus:

- View all tickets for their company if company policy allows.
- Invite/request additional customer users where enabled.
- Manage company support users where permitted.
- See assigned support plan and support-contact information.

## 5.3 Support Agent

Can:

- View tickets for assigned teams/accounts according to permissions.
- Accept/pick up tickets.
- Reply publicly.
- Add internal notes.
- Change allowed ticket statuses.
- Add/edit tags.
- Request information from customer.
- Resolve tickets.
- Escalate tickets.
- Reassign within permitted teams.

## 5.4 Support Manager

Includes Support Agent permissions plus:

- View all tickets under managed teams/accounts.
- Assign/reassign tickets.
- Override priority.
- Override SLA only with reason and audit record.
- Manage escalations.
- View team metrics and SLA reports.
- Manage agent availability/workload.

## 5.5 Account Manager

Can:

- View support activity for assigned customer accounts.
- View tickets, escalations and SLA risk for those accounts.
- Receive configurable notifications.
- Add internal notes if permitted.
- Participate in escalations.

Account Manager does not automatically need ticket-administration rights unless separately assigned.

## 5.6 System Administrator / Super Admin

Full administration including:

- Customer accounts.
- Users.
- Roles.
- Teams.
- Support plans.
- SLA policies.
- Business calendars.
- Categories.
- Notification templates.
- Integration credentials.
- Audit logs.
- Reporting configuration.
- Manual provisioning.

---

# 6. Customer Account Model

The primary tenant is the **Customer Account / Company**.

Recommended fields:

| Field | Description |
|---|---|
| id | Internal UUID |
| account_code | Human-readable unique customer/account code |
| company_name | Customer company name |
| status | ACTIVE, SUSPENDED, EXPIRED, DISABLED |
| country | Country |
| timezone | Default customer timezone |
| support_plan_id | Current assigned support plan |
| entitlement_source | AIVHUB or MANUAL |
| support_start_date | Start date |
| support_end_date | Optional end date |
| support_team_id | Primary support team |
| account_manager_id | Primary account manager |
| support_manager_id | Responsible support manager |
| business_calendar_id | SLA calendar |
| customer_ticket_visibility | OWN_ONLY or ACCOUNT_WIDE |
| notes_internal | Internal-only account note |
| created_at | UTC timestamp |
| updated_at | UTC timestamp |

### Account Status Rules

**ACTIVE** - users can log in and create tickets.  
**SUSPENDED** - login/ticket creation behaviour is configurable; default is existing tickets readable but new tickets blocked.  
**EXPIRED** - new ticket creation blocked unless administrator overrides.  
**DISABLED** - account inaccessible to customers; historic data retained.

Never hard-delete a customer account merely because access ends.

---

# 7. Support User Provisioning

## 7.1 Provisioning Method A - AIVHUB Integration

AIVHUB is responsible for commercial purchasing and entitlement decisions. Once AIVHUB determines that a user/company should receive support access, it calls the support application's secure provisioning endpoint.

### Required Provisioning Input

Suggested payload:

```json
{
  "externalAccountId": "AIVHUB-CUST-12345",
  "companyName": "ABC Limited",
  "country": "United Kingdom",
  "timezone": "Europe/London",
  "supportPlanCode": "PREMIUM",
  "supportStartDate": "2026-08-20",
  "supportEndDate": "2027-08-19",
  "primaryUser": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@abc.com",
    "mobile": "+44..."
  },
  "metadata": {
    "aivCustomerReference": "ABC001"
  }
}
```

The payload must not include card details, payment tokens, invoice data or confidential financial data.

### Provisioning Processing Rules

1. Authenticate the AIVHUB request.
2. Validate schema.
3. Check idempotency key/request ID.
4. Find existing account by trusted external account ID.
5. If account does not exist, create it.
6. If account exists, update allowed entitlement/profile fields.
7. Find user by account + email.
8. Create user only if not already present.
9. Attach support plan.
10. Assign support team, manager and account manager using rules/defaults.
11. Generate activation token for new user.
12. Queue activation email.
13. Notify responsible internal users of new account/user if configured.
14. Store integration audit record.
15. Return deterministic success response.

### Idempotency

AIVHUB may retry a request. Repeated requests with the same idempotency key must not create duplicate accounts or users.

Suggested endpoint:

```http
POST /api/integrations/aivhub/support-accounts/provision
```

Suggested headers:

```text
Authorization: Bearer <integration credential> or signed request mechanism
Idempotency-Key: <unique AIVHUB request id>
```

## 7.2 Provisioning Method B - Manual Support Account Creation

AIV administrators must be able to create support access without any AIVHUB request.

Use cases include:

- POC customer.
- Partner.
- Complimentary support.
- Offline commercial agreement.
- Internal test account.
- Migration from an older support process.
- Special/temporary support access.
- Customer whose support access should be created manually by AIV staff.

### Admin Flow

Admin selects:

**Admin -> Customers -> Create Support Account**

Form fields:

- Company name.
- Account/customer code.
- Country.
- Timezone.
- Support plan.
- Support start date.
- Support end date, optional.
- Primary support team.
- Support manager.
- Account manager.
- Customer ticket visibility policy.
- Internal notes.

Primary user fields:

- First name.
- Last name.
- Support email/login email.
- Mobile, optional.
- Customer role: Customer Admin or Customer User.

Actions:

- **Create & Send Activation**.
- **Create Without Sending Email**.
- **Save Draft** if desired.

### Duplicate Detection

Before creation, check:

- Existing external/customer code.
- Existing company name similarity as a warning only.
- Existing support email.

If email already exists under the same account, show the existing user rather than create a duplicate.

If email exists under a different account, block by default and require an administrator decision because one email may otherwise cross tenant boundaries.

## 7.3 Add User to Existing Account

Admin must be able to:

1. Open customer account.
2. Select **Add Support User**.
3. Enter name and email.
4. Choose customer role.
5. Send activation email.

The added user inherits the account's support plan and account-level permissions; individual SLA plans should not normally be assigned per user.

## 7.4 Resend Activation

Admin can resend activation when:

- User did not receive email.
- Activation token expired.
- User never completed registration.

Generating a new activation token must invalidate older activation tokens.

---

# 8. Authentication and Account Activation

## 8.1 Preferred Activation Method

Use a secure one-time activation link.

Flow:

```text
User record created
 -> cryptographically secure activation token generated
 -> token hash stored
 -> activation email sent
 -> user opens link
 -> token validated
 -> user creates password
 -> account activated
 -> token invalidated
```

Recommended configurable activation expiry: 24 hours.

## 8.2 Optional Temporary Password Mode

If AIV insists on temporary passwords:

- Generate a strong random password.
- Temporary password expires after a short configurable period.
- Force password reset on first successful login.
- Never store the plaintext password.
- Do not log the password.
- Prefer sending activation link rather than reusable credentials.

## 8.3 Password Features

- Forgot password.
- Reset password token expiry.
- Password complexity configuration.
- Session expiry.
- Logout from all sessions option.
- Failed-login rate limiting.
- Optional MFA, especially for internal staff.

---

# 9. Support Plans

Support plans represent service entitlement and SLA rules. They do not represent payment inside this application.

Example plan records:

- STANDARD.
- PREMIUM.
- ENTERPRISE.
- PARTNER.
- POC.
- INTERNAL.

Plan names and values must be configurable.

Recommended plan fields:

| Field | Description |
|---|---|
| code | Unique plan code used by AIVHUB/manual provisioning |
| name | Display name |
| active | Whether plan can be newly assigned |
| support_channels | Email, portal, phone etc. |
| business_calendar_id | Default calendar |
| allow_24x7_p1 | Boolean |
| max_customer_users | Optional |
| description | Customer-facing description |
| internal_notes | Internal notes |

---

# 10. SLA Policy Model

SLA must be configurable by **Support Plan + Priority**.

Each policy should contain at least:

- First response target.
- Resolution target.
- Measurement type: business minutes or calendar minutes.
- Customer-wait pause behaviour.
- Internal-wait pause behaviour.
- Vendor-wait pause behaviour.
- 24x7 override if applicable.
- Warning thresholds.
- Escalation rules.
- Status Active/Inactive.
- Effective dates if versioning is implemented.

Example configuration only, not contractual defaults:

| Priority | First Response Target | Resolution Target | Clock |
|---|---:|---:|---|
| P1 Critical | Configurable | Configurable | 24x7 or plan calendar |
| P2 High | Configurable | Configurable | Business calendar |
| P3 Medium | Configurable | Configurable | Business calendar |
| P4 Low | Configurable | Configurable | Business calendar |

No SLA duration should be hard-coded in UI or application logic.

---

# 11. Business Hours, Calendars and Timezones

The SLA engine must support genuine business-time calculations.

A business calendar includes:

- Timezone.
- Monday-Sunday opening/closing times.
- Closed days.
- Holiday dates.
- Optional exceptional opening dates.

All persisted system timestamps should be stored in UTC. User interfaces display dates in the relevant user/account timezone.

Example:

```text
Ticket created Friday 16:00
Support closes Friday 17:30
SLA remaining after Friday = 2h 30m
Remaining 1h continues on next working day
```

Do not calculate business SLA as simply `created_at + duration`.

---

# 12. Ticket Model

Each support ticket should include:

| Field | Notes |
|---|---|
| id | UUID |
| ticket_number | Human-readable e.g. AIV-000001 |
| account_id | Customer tenant |
| created_by_user_id | Customer/internal creator |
| ticket_type | Incident, Service Request, Question, Bug, Feature Request, etc. |
| category_id | Configurable category |
| subject | Required |
| description | Required |
| priority | P1/P2/P3/P4 |
| impact | Optional structured impact |
| urgency | Optional structured urgency |
| status | Ticket workflow status |
| environment | Production/UAT/Test/Development/Other |
| aiv_version | Optional but recommended |
| assigned_team_id | Support team |
| assigned_agent_id | Optional until accepted |
| account_manager_id_snapshot | Optional operational snapshot |
| tags | Search/report labels |
| created_at | UTC |
| updated_at | UTC |
| first_human_response_at | UTC |
| resolved_at | UTC |
| closed_at | UTC |
| resolution_category | Required on resolution if configured |
| root_cause | Optional/required by policy |
| resolution_notes | Public/internal split as appropriate |

---

# 13. Ticket Numbering

Use a customer-friendly immutable ticket number such as:

```text
AIV-000001
AIV-000002
```

Internally use UUIDs. Ticket numbers must never be reused.

---

# 14. Ticket Types and Categories

## 14.1 Ticket Types

Configurable initial values:

- Incident.
- Service Request.
- Question.
- Bug.
- Feature Request.
- Configuration Request.
- Security Issue.

## 14.2 AIV Categories

Initial suggested categories:

- Installation.
- Upgrade.
- Login / Authentication.
- SSO.
- License.
- Dashboard.
- Report.
- BIRT Report.
- Visualization.
- Dataset.
- Database Connection.
- API.
- Integration.
- Scheduler.
- Export.
- Performance.
- Security.
- Configuration.
- Bug.
- Feature Request.
- General Query.
- Other.

Categories must be editable by Admin.

---

# 15. Ticket Creation Form

## 15.1 Required Fields

- Subject.
- Description.
- Ticket type.
- Category.
- Impact/priority input.
- Environment.

## 15.2 Recommended Fields

- AIV version.
- Number of users affected.
- Error message.
- Steps to reproduce.
- Workaround available: Yes/No.
- Attachments.
- Related ticket number.

## 15.3 Customer Priority Handling

Customers may select urgency/impact, but the system should calculate a suggested priority rather than allow every issue to become P1 without controls.

Suggested impact values:

- Entire organisation affected.
- Multiple users affected.
- Single user affected.
- Minor/no operational impact.

Suggested urgency values:

- Business stopped/no workaround.
- Major disruption.
- Workaround available.
- Minor inconvenience/question.

The system maps Impact + Urgency to P1-P4. Managers can override priority with a required reason.

---

# 16. Ticket Status Workflow

Recommended statuses:

- NEW.
- OPEN.
- IN_PROGRESS.
- WAITING_FOR_CUSTOMER.
- WAITING_FOR_INTERNAL_TEAM.
- WAITING_FOR_VENDOR.
- RESOLVED.
- CLOSED.
- CANCELLED.

Recommended flow:

```text
NEW
 -> OPEN
 -> IN_PROGRESS
 -> WAITING_FOR_CUSTOMER / WAITING_FOR_INTERNAL_TEAM / WAITING_FOR_VENDOR
 -> IN_PROGRESS
 -> RESOLVED
 -> CLOSED
```

Reopen flow:

```text
RESOLVED -> IN_PROGRESS
```

Closed tickets may be reopened only according to a configurable reopen-window policy.

Every status transition must be recorded in ticket history.

---

# 17. Ticket Creation Processing

When a user submits a ticket, the backend must perform the following as one reliable workflow:

1. Validate authenticated user.
2. Validate account is allowed to create tickets.
3. Validate form and attachment metadata.
4. Generate ticket UUID and ticket number.
5. Determine ticket priority.
6. Resolve account support plan.
7. Resolve applicable SLA policy.
8. Create immutable SLA snapshot for this ticket.
9. Calculate first-response due timestamp.
10. Calculate resolution due timestamp.
11. Determine support team.
12. Determine assigned agent if auto-assignment is enabled.
13. Store initial ticket event/history.
14. Queue internal ticket-created notifications.
15. Schedule customer acknowledgement email.
16. Return success immediately after durable ticket creation; email sending must not block ticket creation.

---

# 18. Ticket Routing and Assignment

Every account should have a default:

- Support team.
- Support manager.
- Account manager.

Routing can later use category/skills, but the first version should support:

1. Dedicated account team.
2. Category-based team override.
3. Manual assignment.
4. Round-robin assignment.
5. Least-active-ticket assignment.

Agent statuses:

- AVAILABLE.
- BUSY.
- AWAY.
- ON_LEAVE.
- INACTIVE.

ON_LEAVE and INACTIVE agents must not receive automatic assignments.

If no eligible agent is available:

- Ticket remains in the team's **Unassigned** queue.
- Support manager is notified.
- SLA continues according to policy.

---

# 19. Internal Notification on Ticket Creation

When a ticket is created, notify relevant internal users, not every support user in the entire organisation.

Default recipients:

- Assigned agent, if assigned.
- All active agents of the responsible support team, configurable.
- Support manager for that account/team.
- Account manager, configurable.

P1 tickets may use stronger mandatory notification rules.

---

# 20. Automatic Customer Acknowledgement

AIV requires an automatic acknowledgement email within **5-15 minutes** after ticket creation.

Create an admin setting:

```text
Acknowledgement delay = configurable number of minutes
Default recommended value = 5 minutes
Allowed normal range = 5-15 minutes
```

A durable background job must send the acknowledgement even if the user logs out.

Important rules:

- Acknowledgement is a **system message**.
- It appears in ticket timeline as `SYSTEM_ACKNOWLEDGEMENT` if desired.
- It does **not** populate `first_human_response_at`.
- It does **not** stop first-response SLA.
- If the email provider fails, retry according to notification retry policy.

Suggested email content:

```text
Subject: [AIV-000123] Your support request has been received

Hello {{customerName}},

We have received your AIV support request.

Ticket: {{ticketNumber}}
Subject: {{ticketSubject}}
Priority: {{priority}}
Status: {{status}}

Our support team has been notified and will review your request.

Track your ticket: {{ticketUrl}}
```

---

# 21. Ticket Conversation

Each ticket has a chronological timeline consisting of event types such as:

- Customer message.
- Public agent reply.
- Internal note.
- System acknowledgement.
- Assignment change.
- Priority change.
- Status change.
- SLA pause/resume.
- Escalation.
- Attachment event.
- Resolution.
- Reopen.
- Closure.

## Public Reply

Visible to customer and eligible internal users. Customer receives email notification.

## Internal Note

Visible only to authorised internal staff. Never expose through customer APIs, exports or notification emails.

The UI must make Public Reply and Internal Note visually distinct to reduce accidental disclosure.

---

# 22. First-Response SLA

Start:

```text
Ticket created_at
```

Stop:

```text
Timestamp of first PUBLIC HUMAN response by an internal support user
```

The following must not count:

- Automatic acknowledgement.
- Automated assignment email.
- Internal note.
- System-generated status update.

Store:

- first_response_due_at.
- first_human_response_at.
- first_response_breached boolean.
- first_response_elapsed_business_minutes.

---

# 23. Resolution SLA

Start at ticket creation unless policy states otherwise.

End at `RESOLVED`.

The SLA policy controls whether time pauses during:

- WAITING_FOR_CUSTOMER.
- WAITING_FOR_INTERNAL_TEAM.
- WAITING_FOR_VENDOR.

Store all pause/resume intervals, not merely a final paused-minute total.

---

# 24. SLA Snapshot

At ticket creation, copy the applicable SLA policy details into a ticket-level SLA snapshot.

Snapshot should include:

- Support plan code/name.
- Priority.
- First-response target duration.
- Resolution target duration.
- Business calendar reference/version.
- Pause rules.
- 24x7 rule.
- Warning thresholds.
- Calculated due dates.

If the customer's support plan later changes, existing ticket snapshots stay unchanged by default.

Any manual SLA override must record:

- Previous value.
- New value.
- Administrator/manager.
- Reason.
- Timestamp.

---

# 25. SLA Warning and Escalation

Warning thresholds should be configurable per SLA policy or globally.

Recommended default operational thresholds:

- 50% consumed - optional informational flag.
- 75% consumed - warning.
- 90% consumed - urgent warning.
- 100% consumed - breach.

Example notification defaults:

| Threshold/Event | Agent | Support Manager | Account Manager |
|---|---:|---:|---:|
| 75% | Yes | Optional | No |
| 90% | Yes | Yes | Optional |
| Breach | Yes | Yes | Yes |

For P1, escalation can be more aggressive.

The ticket UI must clearly show:

- Time remaining.
- SLA percentage consumed.
- Due timestamp.
- Met/Breached state.
- Paused state and reason.

Do not rely solely on colour; show text/icon labels for accessibility.

---

# 26. Waiting for Customer

When an agent requests customer information:

1. Send public reply.
2. Set status to WAITING_FOR_CUSTOMER.
3. Pause resolution SLA if policy permits.
4. Record pause timestamp and reason.
5. Notify customer.

When customer replies:

1. Add customer reply.
2. Change status to IN_PROGRESS automatically, unless a manager-configured rule says otherwise.
3. Resume SLA if paused.
4. Notify assigned agent/team.
5. Record SLA resume event.

---

# 27. Resolution and Closure

When resolving, agent should complete configurable fields:

- Resolution summary.
- Resolution category.
- Root cause.
- Customer-facing resolution text.
- Internal notes if needed.

Suggested resolution categories/root causes:

- Product Bug.
- Configuration.
- Customer Environment.
- Database.
- Network.
- Authentication/Permission.
- Incorrect Usage.
- Third Party.
- Known Issue.
- Documentation.
- Enhancement Request.
- Other.

After resolution:

- Notify customer.
- Customer may reopen during configured reopen window.
- Auto-close after configurable number of days without a customer response.

Recommended default behaviour:

```text
RESOLVED -> wait X days -> CLOSED
```

Admin controls X.

---

# 28. Reopening

Customer can reopen a resolved ticket only during an allowed period.

When reopened:

- Status becomes IN_PROGRESS.
- Assigned team remains unchanged unless routing rules say otherwise.
- Assigned agent remains if active; otherwise manager/team queue receives it.
- Resolution SLA resumes/recalculates according to configured reopen policy.
- First-response SLA does not restart by default.
- Complete previous resolution history remains visible.

After the reopen window, customer should create a new ticket and optionally link the prior ticket.

---

# 29. Attachments

Support common support file types such as:

- PNG/JPG/JPEG.
- PDF.
- TXT/LOG.
- CSV.
- ZIP where allowed.

Admin-configurable limits:

- Maximum file size.
- Maximum total attachment size per ticket.
- Allowed/blocked extensions.

Security:

- Validate extension and MIME type.
- Use private object storage.
- Use short-lived signed download URLs.
- Scan files for malware where infrastructure supports it.
- Never expose storage bucket paths publicly.
- Enforce tenant permission before issuing download link.

---

# 30. Email and Notification Engine

Emails must be template-driven, not hard-coded across business logic.

Recommended template keys:

- ACCOUNT_CREATED.
- ACCOUNT_ACTIVATION.
- ACTIVATION_RESEND.
- PASSWORD_RESET.
- NEW_SUPPORT_ACCOUNT_INTERNAL.
- TICKET_CREATED_INTERNAL.
- TICKET_ACKNOWLEDGED.
- TICKET_ASSIGNED.
- AGENT_PUBLIC_REPLY.
- CUSTOMER_REPLY.
- STATUS_CHANGED.
- WAITING_FOR_CUSTOMER.
- SLA_WARNING.
- SLA_BREACHED.
- TICKET_ESCALATED.
- TICKET_RESOLVED.
- TICKET_CLOSED.
- TICKET_REOPENED.
- SUPPORT_ACCESS_EXPIRING.
- SUPPORT_ACCESS_EXPIRED.

Template variables may include:

```text
{{customerName}}
{{companyName}}
{{ticketNumber}}
{{ticketSubject}}
{{ticketStatus}}
{{priority}}
{{agentName}}
{{supportTeam}}
{{accountManager}}
{{ticketUrl}}
{{planName}}
{{firstResponseDue}}
{{resolutionDue}}
```

## Notification Delivery Record

Persist:

- Notification type.
- Recipient.
- Channel.
- Template/version.
- Queued timestamp.
- Sent timestamp.
- Failed timestamp.
- Attempt count.
- Last error.

Retry failed email notifications with exponential or configured retry intervals.

Ticket creation must not fail because the email provider is temporarily unavailable.

---

# 31. Notification Matrix

Default behaviour; Admin should eventually make most rules configurable.

| Event | Customer | Assigned Agent | Support Team | Support Manager | Account Manager |
|---|---:|---:|---:|---:|---:|
| Account created | Yes | No | No | Optional | Yes/Optional |
| User activation | Yes | No | No | No | No |
| Ticket created | Confirmation in UI | Yes | Yes | Yes | Configurable |
| Acknowledgement | Yes | No | No | No | No |
| Ticket assigned | Optional | Yes | Optional | No | No |
| Agent public reply | Yes | No | No | No | No |
| Customer reply | No | Yes | Configurable | No | No |
| Waiting for customer | Yes | No | No | No | No |
| SLA 75% | No | Yes | No | Optional | No |
| SLA 90% | No | Yes | Optional | Yes | Optional |
| SLA breach | Configurable | Yes | Optional | Yes | Yes |
| Resolved | Yes | No | No | Optional | Optional |
| Reopened | Confirmation | Yes | Optional | Optional | Optional |
| Closed | Yes | No | No | No | No |

---

# 32. Customer Portal UX

## Navigation

- Dashboard.
- Tickets.
- Create Ticket.
- Support Plan / Support Information.
- My Profile.
- Knowledge Base later/optional.

## Customer Dashboard

Cards:

- Open Tickets.
- Waiting for Support.
- Waiting for Me.
- Resolved Tickets.

Recent ticket table:

- Ticket Number.
- Subject.
- Priority.
- Status.
- Created.
- Last Updated.
- Assigned Team if AIV wants this customer-visible.

Filters:

- Status.
- Priority.
- Category.
- Created date.
- Created by.
- Ticket number.
- Keyword.

## Customer Ticket Detail

Header:

- Ticket number.
- Subject.
- Status.
- Priority.
- Category.
- Created date.
- Last updated.

Body:

- Conversation timeline.
- Reply box.
- Attachments.
- Public ticket events.

Optional SLA section:

- First-response status.
- Resolution due/target.

Customer SLA visibility should be configurable if AIV does not want all internal SLA details exposed.

---

# 33. Agent Portal UX

## Navigation

- Dashboard.
- My Tickets.
- Unassigned.
- Team Tickets.
- All Permitted Tickets.
- Customers.
- Reports.

## Agent Dashboard

Cards:

- My Open Tickets.
- Unassigned Team Tickets.
- P1/P2 Tickets.
- SLA At Risk.
- SLA Breached.
- Waiting for Customer.

Queue table fields:

- Ticket number.
- Customer.
- Subject.
- Priority.
- Status.
- Assigned agent.
- Created.
- First-response SLA remaining.
- Resolution SLA remaining.

## Agent Ticket Detail

Main area:

- Ticket conversation.
- Public Reply composer.
- Internal Note composer.
- Attachments.

Right panel:

- Customer/company.
- Support plan.
- Status.
- Priority.
- Type/category.
- Environment.
- AIV version.
- Team.
- Assigned agent.
- Account manager.
- Tags.
- SLA clocks.
- Related tickets.

Actions:

- Assign to me.
- Reassign.
- Change status.
- Change priority if permitted.
- Escalate.
- Resolve.
- Mark duplicate/link ticket.

---

# 34. Manager Dashboard

Manager dashboard should include:

- Tickets created today/week/month.
- Open backlog.
- Unassigned tickets.
- P1/P2 count.
- SLA at risk.
- SLA breached.
- Resolved today.
- Average first human response time.
- Average resolution time.
- SLA compliance percentage.
- Tickets waiting for customer.
- Agent workload.

Charts/tables:

- Ticket trend.
- Tickets by account.
- Tickets by category.
- Tickets by priority.
- Tickets by agent.
- Tickets by AIV version.
- SLA compliance trend.
- Aging buckets.

---

# 35. Customer Account Detail for Internal Staff

A customer account page should show:

- Company profile.
- Account code.
- Support status.
- Entitlement source: AIVHUB or MANUAL.
- Support plan.
- Start/end dates.
- Support team.
- Support manager.
- Account manager.
- Customer users.
- Open tickets.
- Recent tickets.
- SLA metrics.
- Internal notes.
- Audit/change history.

Actions:

- Add support user.
- Resend activation.
- Disable user.
- Update plan.
- Update support dates.
- Change team/manager.
- Suspend/reactivate support access.

---

# 36. Administration Screens

Admin UI should include:

## Customers

- Accounts.
- Users.
- Manual Account Creation.

## Support Configuration

- Support Plans.
- SLA Policies.
- Priorities.
- Ticket Types.
- Ticket Categories.
- Business Calendars.
- Holiday Calendars.
- Reopen/auto-close rules.

## Organisation

- Support Teams.
- Agents.
- Support Managers.
- Account Managers.
- Agent availability.

## Communications

- Email templates.
- Notification settings.
- Sender configuration.

## Integrations

- AIVHUB integration configuration.
- Integration request logs.
- Integration credentials/rotation where appropriate.

## Security & Audit

- Role management.
- Audit logs.
- Login/session logs where required.

---

# 37. Search

Global/internal ticket search should support:

- Ticket number.
- Subject.
- Description where appropriate.
- Company.
- Customer email.
- Status.
- Priority.
- Type.
- Category.
- Agent.
- Team.
- Tag.
- AIV version.
- Created date range.
- Updated date range.

Customer search must remain restricted to that customer account.

---

# 38. Duplicate, Related and Linked Tickets

MVP should at least support **Related Ticket** and **Duplicate Of** relationships.

Fields/relationship types:

- RELATED_TO.
- DUPLICATE_OF.
- PARENT_OF / CHILD_OF later if needed.

When marking duplicate:

- Select canonical ticket.
- Preserve duplicate ticket history.
- Add relation event.
- Optionally resolve/close duplicate.

Ticket merging can be a later feature.

---

# 39. Engineering Escalation - Recommended Extension

A support ticket may eventually need an engineering reference.

Optional fields:

- engineering_system.
- engineering_reference.
- internal_engineering_status.
- escalated_at.
- escalated_by.

Example:

```text
Support Ticket: AIV-001245
Engineering Jira: AIVDEV-847
```

Customer must not automatically see private Jira/development data.

---

# 40. Audit Trail

Audit all significant actions:

- Account created/updated/suspended.
- Support user created/activated/disabled.
- Plan changed.
- Support dates changed.
- Team/manager changed.
- Ticket created.
- Priority changed.
- Status changed.
- Agent assigned/reassigned.
- Public reply created.
- Internal note created.
- Attachment uploaded/deleted where allowed.
- SLA started/paused/resumed/overridden/breached.
- Ticket resolved/reopened/closed.
- Integration provisioning received.
- Admin security/configuration changes.

Audit record should contain:

- id.
- actor_user_id or SYSTEM/INTEGRATION.
- action.
- entity_type.
- entity_id.
- old_value where applicable.
- new_value where applicable.
- reason where required.
- IP/user-agent where appropriate.
- timestamp UTC.

Audit history should be append-only for normal users.

---

# 41. Ticket History vs Audit Log

Maintain both concepts:

**Ticket Timeline/History** is human-readable operational history shown on ticket.

Example:

```text
10:01 Ticket created by John Smith
10:01 Routed to UK Support
10:05 Automatic acknowledgement sent
10:18 Assigned to David
10:31 David replied to customer
11:04 Waiting for Customer
13:15 Customer replied
13:15 SLA resumed
14:40 Ticket resolved
```

**Audit Log** is a lower-level security/compliance record and may contain technical before/after data.

---

# 42. Recommended Database Schema

A relational database such as PostgreSQL is recommended.

Core tables:

```text
accounts
users
roles
user_roles
support_plans
support_entitlements
sla_policies
business_calendars
business_calendar_hours
holiday_dates
support_teams
support_team_members
account_assignments
ticket_types
ticket_categories
tickets
ticket_sla_snapshots
ticket_sla_events
ticket_messages
ticket_attachments
ticket_relations
ticket_status_history
ticket_assignment_history
notifications
notification_attempts
email_templates
audit_logs
integration_requests
customer_satisfaction    -- optional/phase 2
```

## 42.1 `support_entitlements`

This table is **not a payment table**. It represents support access received from AIVHUB or entered manually.

Recommended fields:

```text
id
account_id
support_plan_id
source              -- AIVHUB / MANUAL
external_reference  -- optional AIVHUB reference
start_date
end_date
status               -- ACTIVE / SUSPENDED / EXPIRED / DISABLED
created_by
created_at
updated_at
```

## 42.2 `tickets`

Recommended critical fields:

```text
id UUID
ticket_number
account_id
created_by_user_id
assigned_team_id
assigned_agent_id
ticket_type_id
category_id
subject
description
priority
impact
urgency
status
environment
aiv_version
created_at
updated_at
first_human_response_at
resolved_at
closed_at
resolution_category
root_cause
resolution_summary
```

## 42.3 `ticket_sla_snapshots`

```text
id
ticket_id
support_plan_code
sla_policy_id
priority
first_response_target_minutes
resolution_target_minutes
clock_type
business_calendar_id
pause_on_customer_wait
pause_on_internal_wait
pause_on_vendor_wait
first_response_due_at
resolution_due_at
created_at
```

## 42.4 `ticket_sla_events`

Event types:

```text
START
PAUSE
RESUME
FIRST_HUMAN_RESPONSE
WARNING_50
WARNING_75
WARNING_90
FIRST_RESPONSE_BREACH
RESOLUTION_BREACH
RESOLVED
REOPENED
OVERRIDE
```

Store event timestamp, reason and actor.

---

# 43. API Specification

Use versioned REST APIs unless the implementation standard requires GraphQL.

## 43.1 Authentication

```http
POST /api/v1/auth/activate
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

## 43.2 Customer Accounts

```http
GET    /api/v1/accounts
POST   /api/v1/accounts                  -- Admin manual creation
GET    /api/v1/accounts/{id}
PATCH  /api/v1/accounts/{id}
POST   /api/v1/accounts/{id}/users
GET    /api/v1/accounts/{id}/users
PATCH  /api/v1/accounts/{id}/users/{userId}
POST   /api/v1/accounts/{id}/users/{userId}/resend-activation
POST   /api/v1/accounts/{id}/suspend
POST   /api/v1/accounts/{id}/reactivate
```

## 43.3 AIVHUB Integration

```http
POST /api/v1/integrations/aivhub/support-accounts/provision
POST /api/v1/integrations/aivhub/support-accounts/update
POST /api/v1/integrations/aivhub/support-accounts/suspend
POST /api/v1/integrations/aivhub/support-accounts/reactivate
```

These endpoints manage support entitlement only. No payment endpoints are required.

## 43.4 Tickets

```http
POST   /api/v1/tickets
GET    /api/v1/tickets
GET    /api/v1/tickets/{id}
PATCH  /api/v1/tickets/{id}
POST   /api/v1/tickets/{id}/public-replies
POST   /api/v1/tickets/{id}/internal-notes
POST   /api/v1/tickets/{id}/attachments
POST   /api/v1/tickets/{id}/assign
POST   /api/v1/tickets/{id}/status
POST   /api/v1/tickets/{id}/priority
POST   /api/v1/tickets/{id}/escalate
POST   /api/v1/tickets/{id}/resolve
POST   /api/v1/tickets/{id}/reopen
POST   /api/v1/tickets/{id}/relations
GET    /api/v1/tickets/{id}/timeline
```

## 43.5 Support Configuration

```http
GET/POST/PATCH /api/v1/admin/support-plans
GET/POST/PATCH /api/v1/admin/sla-policies
GET/POST/PATCH /api/v1/admin/support-teams
GET/POST/PATCH /api/v1/admin/ticket-types
GET/POST/PATCH /api/v1/admin/ticket-categories
GET/POST/PATCH /api/v1/admin/business-calendars
GET/POST/PATCH /api/v1/admin/email-templates
```

## 43.6 Reports

```http
GET /api/v1/reports/ticket-summary
GET /api/v1/reports/sla-compliance
GET /api/v1/reports/agent-performance
GET /api/v1/reports/customer-summary
GET /api/v1/reports/ticket-trends
```

---

# 44. AIVHUB Integration Security

The provisioning endpoint must not be publicly trusted simply because it has a secret URL.

Implement one strong method such as:

- Signed HMAC requests with timestamp and replay protection, or
- OAuth2 client credentials/service-to-service token, or
- Strong API credential with IP/network restrictions where suitable.

Required controls:

- TLS only.
- Credential rotation.
- Idempotency key.
- Request timestamp/replay protection.
- Schema validation.
- Rate limiting.
- Integration audit log.
- Do not put credentials in frontend code.

---

# 45. Background Jobs / Worker Requirements

The system needs server-side scheduled/background processing for:

- Delayed ticket acknowledgement.
- SLA 50/75/90% checks.
- SLA breach detection.
- Escalation notifications.
- Auto-close of resolved tickets.
- Support-access expiry reminders if AIV enables them.
- Notification/email retries.
- Cleanup of expired activation/reset tokens.
- Optional CSAT messages.

Do not implement SLA timers in browser JavaScript as the source of truth.

---

# 46. Support Access Expiry

The support system may receive an end date from AIVHUB or a manual administrator.

Optional reminders:

- 30 days before.
- 14 days before.
- 7 days before.
- 1 day before.

When support access expires, recommended default:

- Existing historic tickets remain viewable.
- New ticket creation is blocked.
- Existing open-ticket continuation is configurable.
- Admin can extend/reactivate manually.

Do not delete the customer account or ticket history.

---

# 47. Reporting Requirements

## Operational Reports

- Ticket volume by day/week/month.
- Open backlog.
- Unassigned tickets.
- Ticket aging.
- P1/P2 open tickets.
- Waiting-for-customer count.

## SLA Reports

- First-response SLA compliance %.
- Resolution SLA compliance %.
- Breach count.
- Average first human response time.
- Average resolution time.
- SLA performance by plan.
- SLA performance by customer.
- SLA performance by agent/team.

## Product Insight Reports

- Tickets by AIV version.
- Tickets by category/module.
- Top recurring issues.
- Bugs vs questions vs configuration.
- Feature request volume.

## Customer Report

Per account:

- Ticket count.
- Open/closed split.
- Priority split.
- SLA compliance.
- Average response/resolution.
- Top issue categories.

Reports should support date filters and CSV/XLSX export where practical.

---

# 48. Security Requirements

Minimum requirements:

- HTTPS only.
- Strong authentication.
- Secure password hashing or managed identity provider.
- Short-lived activation/reset tokens.
- Server-side RBAC.
- Tenant/account authorization checks on every customer resource request.
- Rate limiting.
- Protection against SQL injection using parameterised queries/ORM.
- XSS-safe rendering and output encoding.
- CSRF protection where applicable.
- Secure session cookies/tokens.
- Secrets in secure environment/configuration, never source code.
- Private attachment storage.
- File-type validation.
- Audit logs.
- Optional MFA for internal staff.
- Account/user disable capability.
- Logging must never include passwords or activation/reset secrets.

Critical authorization rule:

```text
For every customer ticket operation:
authenticated_user.account_id must equal ticket.account_id
unless the user is an authorised internal staff member.
```

Never rely on a hidden frontend button to enforce this.

---

# 49. Non-Functional Requirements

## Reliability

- Ticket creation must be transactional/durable.
- Email failure must not lose ticket creation.
- Background jobs must be retryable.
- Integration provisioning must be idempotent.

## Performance

Target normal UI/API responses under approximately 2 seconds for standard operations under expected load, excluding large file uploads and external email delivery.

Use pagination for ticket lists and audit logs.

## Scalability

Design for increasing numbers of:

- Customer accounts.
- Customer users.
- Tickets.
- Messages.
- Attachments.
- Notifications.

Avoid loading all tickets/messages in memory.

## Observability

Provide server logs and metrics for:

- Failed provisioning calls.
- Failed jobs.
- Failed email notifications.
- SLA job health.
- API errors.
- Authentication failures/rate limiting.

---

# 50. Important Edge Cases

Bolt must handle and test at least the following:

1. Same AIVHUB provisioning request received multiple times.
2. AIVHUB sends an update for an unknown account.
3. Support email already exists in same account.
4. Same email exists in a different account.
5. Manual admin tries to create duplicate account/user.
6. User never activates account.
7. Activation link expires.
8. Admin resends activation.
9. User forgets password.
10. Account is expired when user creates a ticket.
11. Account becomes suspended while tickets are open.
12. Support plan changes after tickets already exist.
13. No agent is available.
14. Assigned agent becomes inactive/on leave.
15. Account manager/support manager changes.
16. Ticket is created outside business hours.
17. Holiday occurs during SLA calculation.
18. P1 is created incorrectly and manager downgrades it.
19. Manager increases priority after ticket creation.
20. SLA policy is changed after ticket creation.
21. Customer does not respond.
22. Customer replies while ticket is WAITING_FOR_CUSTOMER.
23. Customer replies after ticket is RESOLVED.
24. Customer attempts to reopen after reopen window.
25. Duplicate ticket created.
26. Customer attempts another company's ticket URL/API.
27. Attachment extension/MIME mismatch.
28. Attachment exceeds limit.
29. Email sending fails.
30. Delayed acknowledgement worker retries.
31. SLA worker is restarted.
32. Same agent opens ticket from two sessions.
33. Ticket is reassigned while another agent is viewing it.
34. User/account is disabled while logged in.
35. AIVHUB integration credential is invalid/expired.
36. User has two customer roles accidentally assigned.
37. Timezone/daylight-saving transition occurs during SLA window.
38. Manual SLA override is attempted without a reason.
39. Internal note must never be returned by customer APIs.
40. Deactivated agent remains referenced historically but cannot receive new assignments.

---

# 51. Core Acceptance Tests

## AT-01 AIVHUB Automatic Provisioning

**Given** a valid signed provisioning request for a new customer  
**When** the request is processed  
**Then**:

- Account is created.
- Support entitlement is created.
- Support plan is assigned.
- Primary user is created.
- Support team/manager/account manager are assigned using configuration.
- Activation email is queued.
- Internal notification is queued.
- No payment information is created or stored.

## AT-02 Idempotent AIVHUB Provisioning

Submitting the same idempotency key twice must return the same logical result and must not duplicate account/user records.

## AT-03 Manual Support Account Creation

**Given** an administrator enters customer/company, plan, support dates and user email  
**When** they select Create & Send Activation  
**Then** the customer account and user are created and the activation email is queued without requiring any payment/purchase record.

## AT-04 Account Activation

User opens valid activation link, creates password, becomes ACTIVE and can log in.

## AT-05 Ticket Creation

Customer creates a P2 ticket. System:

- Generates ticket number.
- Applies current support plan.
- Creates SLA snapshot.
- Calculates due dates.
- Routes to correct support team.
- Notifies agents/manager according to rules.
- Schedules acknowledgement.

## AT-06 Automatic Acknowledgement

Acknowledgement is sent after configured delay within expected 5-15 minute policy and is visible as a system event. It must not set first human response.

## AT-07 First Human Response

First public reply from an authorised internal support user sets `first_human_response_at` and evaluates first-response SLA.

## AT-08 Internal Note Privacy

Customer API and UI never expose internal-note body or internal-only attachments.

## AT-09 Waiting for Customer

When ticket becomes WAITING_FOR_CUSTOMER, resolution SLA pauses if policy requires. Customer reply resumes SLA and changes ticket to IN_PROGRESS.

## AT-10 SLA Warning and Breach

SLA engine emits each configured warning once and records breach at 100% without duplicate notifications on repeated worker runs.

## AT-11 Resolution and Auto-Close

Resolved ticket not replied to for configured period automatically closes and records system history.

## AT-12 Tenant Isolation

Customer from Account A receives 403/404 when attempting to fetch or modify Account B ticket by ID, ticket number, attachment or relation.

## AT-13 Plan Change Does Not Rewrite Existing Ticket SLA

Changing account support plan affects new tickets only by default; historic ticket SLA snapshots remain unchanged.

---

# 52. Recommended MVP Build Order

Bolt should implement in this order to avoid creating a UI before the core model is stable.

### Phase 1A - Foundation

1. Database schema and migrations.
2. Authentication.
3. RBAC and tenant authorization.
4. Internal user management.
5. Customer accounts and customer users.
6. Manual support-account creation.
7. Account activation/password setup.

### Phase 1B - Entitlement and SLA

8. Support plans.
9. Support entitlements.
10. Business calendars/holidays.
11. SLA policies.
12. AIVHUB provisioning API.
13. Idempotency and integration logs.

### Phase 1C - Ticketing

14. Ticket types/categories.
15. Ticket create/list/detail.
16. Ticket messages.
17. Internal notes.
18. Attachments.
19. Status workflow.
20. Assignment/routing.

### Phase 1D - Automation

21. SLA snapshot and calculation engine.
22. SLA background worker.
23. Delayed acknowledgement.
24. Notification/email service.
25. Escalations.
26. Auto-close and reopen.

### Phase 1E - Operations

27. Customer dashboard.
28. Agent dashboard.
29. Manager dashboard.
30. Admin configuration screens.
31. Reports.
32. Audit-log viewer.
33. Security testing.
34. Acceptance testing.

---

# 53. Phase 2 Features

Do not block MVP on these features, but design the schema/API so they can be added later:

- Knowledge base.
- Suggested knowledge articles before ticket submission.
- Canned agent responses.
- Customer Satisfaction (CSAT).
- Jira integration.
- Engineering escalation workflow.
- Ticket merge.
- Major incident management.
- Email-to-ticket.
- Microsoft Teams/Slack alerts.
- Customer SSO.
- Advanced BI/analytics.
- Customer exports.
- AI categorisation/priority suggestion.
- AI long-ticket summary.
- AI suggested agent reply.
- Similar-ticket detection.

---

# 54. UI/UX Direction for Bolt

Create a clean modern enterprise SaaS interface rather than a consumer-style application.

Design goals:

- Low visual noise.
- Clear status and SLA hierarchy.
- Responsive desktop-first layout.
- Accessible contrast and labels.
- Consistent cards/tables/forms.
- Dense but readable ticket queues for agents.
- Conversation-first ticket detail view.
- Persistent right-side metadata/SLA panel on desktop.
- Confirmation dialogs for destructive or high-impact actions.
- Toasts for successful background-friendly operations.
- Skeleton/loading states.
- Empty states with clear actions.
- No hard-coded fake metrics once backend is connected.

Suggested ticket-status chips:

- New.
- Open.
- In Progress.
- Waiting for Customer.
- Waiting Internal.
- Resolved.
- Closed.

SLA states should show both label and time, for example:

```text
First Response: MET - 31m
Resolution SLA: AT RISK - 42m remaining
```

---

# 55. Bolt.ai Implementation Instructions

The following section can be provided directly to Bolt.ai as the main build instruction.

## MASTER BUILD PROMPT

Build a production-oriented multi-tenant web application named **AIV Support** using this specification as the authoritative requirements document.

### Critical Product Boundary

This is **only a support ticketing system**. Do not implement payment, checkout, pricing calculation, invoice, refund, card processing or purchasing functionality.

AIVHUB is an external website that decides when a company/user receives support. AIV Support receives support-account/entitlement information through a secure server-to-server provisioning API. AIV administrators must also be able to create support accounts and support-user email logins manually from the Admin UI.

### Mandatory Functional Areas

Implement:

1. Authentication and secure account activation.
2. Multi-tenant customer/company accounts.
3. Customer users and Customer Admin role.
4. Internal Support Agent, Support Manager, Account Manager and Super Admin roles.
5. Manual customer/support-user provisioning by Admin.
6. AIVHUB provisioning integration with idempotency.
7. Support plans and support entitlement records.
8. Configurable SLA policies by support plan + ticket priority.
9. Business-hours and holiday-calendar SLA calculations.
10. Ticket creation and human-readable AIV-XXXXXX numbering.
11. Ticket types, categories, priority/impact/urgency.
12. Account/team routing and assignment.
13. Public replies and internal notes with strict privacy separation.
14. Attachments using private storage and authorised download access.
15. Automatic acknowledgement email after configurable 5-15 minute delay.
16. First-human-response SLA tracking where automatic acknowledgement does not count.
17. Resolution SLA with configurable pause/resume rules.
18. SLA snapshots so later account-plan changes do not alter historic tickets.
19. SLA warnings, breaches and escalation notifications.
20. Resolution, auto-close and reopen workflow.
21. Customer, Agent, Manager and Admin dashboards.
22. Search, filtering and reporting.
23. Email-template and notification engine with retries.
24. Append-only audit logging for significant actions.
25. Secure AIVHUB integration endpoints and integration request logs.

### Mandatory Security Rules

- Enforce tenant isolation in backend/API.
- Never expose internal notes through customer endpoints.
- Never store or log plaintext passwords or activation tokens.
- Store all timestamps in UTC.
- Use server-side background jobs for acknowledgements and SLA monitoring.
- Use secure private file storage.
- Protect integration endpoints with strong server-to-server authentication.
- Validate idempotency on AIVHUB provisioning.
- Parameterise database access/use safe ORM practices.
- Add server-side RBAC checks to every privileged endpoint.

### Mandatory Data Rules

- An account can have many customer users.
- A customer user belongs to one customer account in the MVP unless explicitly extended later.
- Each account has a current support entitlement and support plan.
- Entitlement source is AIVHUB or MANUAL.
- Support plan does not contain payment data.
- Each ticket stores an immutable SLA snapshot when created.
- System acknowledgement is a system event, not a human response.
- Every ticket/status/assignment/SLA change is audited.

### Main Pages

Customer:

- Login/Activation/Forgot Password.
- Customer Dashboard.
- My/Company Tickets.
- Create Ticket.
- Ticket Detail.
- Support Information.
- Profile.

Internal:

- Agent Dashboard.
- My Tickets.
- Unassigned Queue.
- Team Tickets.
- Ticket Detail.
- Customers.
- Customer Detail.
- Manager Dashboard.
- Reports.

Admin:

- Accounts.
- Manual Support Account Creation.
- Users.
- Teams.
- Support Plans.
- SLA Policies.
- Business Calendars/Holidays.
- Ticket Types/Categories.
- Email Templates.
- Integration Logs/Settings.
- Audit Logs.

### Build Behaviour

Do not create only static mock pages. Build the data model, permissions and backend workflows behind each screen. Seed the development environment with realistic but clearly dummy customers, support plans, teams, agents and tickets. Keep all plan/SLA settings configurable.

Implement migrations and deterministic seed data. Add validation and useful error messages. Paginate all potentially large lists. Use reusable UI components and a clean enterprise layout.

Create automated tests for the core acceptance tests in this document, especially tenant isolation, idempotent provisioning, SLA snapshot behaviour, automatic acknowledgement not counting as first human response, and internal-note privacy.

Where the exact implementation stack is not dictated by the existing AIV environment, use a modern TypeScript-based stack with a relational PostgreSQL-compatible database. Keep architecture modular so authentication, email, storage and background-job providers can be swapped later.

### Completion Definition

The MVP is complete only when an AIV admin can manually create a customer account and support email user, the user can activate/login/create a ticket, the correct SLA is attached, the support team is notified, automatic acknowledgement is sent after the configured delay, an agent can reply/resolve, SLA warnings work, all data is tenant-isolated, and the same end-to-end provisioning can also be triggered through the secure AIVHUB integration API without any payment functionality inside AIV Support.

---

# 56. Final End-to-End Reference Flow

## AIVHUB-Provisioned Customer

```text
AIVHUB decides support access should be created
 -> AIVHUB calls secure provisioning API
 -> AIV Support creates/updates customer account
 -> Support plan/entitlement assigned
 -> Support team + manager + account manager assigned
 -> Customer support user created
 -> Activation email sent
 -> Internal account-created notification sent
 -> User activates account and creates password
 -> User logs in
 -> User creates ticket
 -> AIV ticket number generated
 -> SLA snapshot created
 -> Ticket routed/assigned
 -> Agents + manager notified
 -> Automatic customer acknowledgement sent after configured delay
 -> Agent provides human response
 -> First-response SLA stopped/evaluated
 -> Ticket investigated
 -> SLA monitored/escalated as required
 -> Agent resolves ticket
 -> Customer notified
 -> Ticket auto-closes or reopens based on policy
 -> Full history remains auditable
```

## Manually Provisioned Customer

```text
AIV Admin opens Manual Support Account Creation
 -> enters company and support user email
 -> selects support plan + dates
 -> assigns support team/manager/account manager
 -> saves account
 -> activation email sent
 -> user activates account
 -> remaining ticket workflow is identical to AIVHUB-provisioned customer
```

---

# 57. Non-Negotiable Requirements Summary

Bolt must not lose these requirements during implementation:

1. No purchasing/payment functionality in AIV Support.
2. Support access can come from AIVHUB or be created manually.
3. Manual support email/user creation is mandatory.
4. Secure activation/password-creation flow is mandatory.
5. Support plan and SLA are configurable.
6. SLA snapshot is created per ticket.
7. Acknowledgement is sent automatically after configurable 5-15 minutes.
8. Automatic acknowledgement never counts as first human response.
9. Relevant agents, support manager and configured account manager are notified on new ticket.
10. Customer and internal/private messages must be strictly separated.
11. SLA must honour business hours/holidays/timezones where configured.
12. SLA warning and breach escalation must run server-side.
13. Multi-tenant data isolation is mandatory.
14. All important actions are audited.
15. Existing support/ticket history must not be deleted when access expires or a user is disabled.

---

**End of Specification**
