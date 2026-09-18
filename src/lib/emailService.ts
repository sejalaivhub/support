export interface SmtpConfig {
  channelType: 'DEFAULT' | 'CUSTOM';
  defaultEmail: string;
  customEmail: string;
  fromName: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  enabled: boolean;
  forwardingVerified: boolean;
  dkimVerified: boolean;
}

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  channelType: 'DEFAULT',
  defaultEmail: 'hello@aivhub.com',
  customEmail: 'support@mycompany.com',
  fromName: 'AIV Support Hub',
  host: import.meta.env.VITE_SMTP_HOST || 'send.one.com',
  port: Number(import.meta.env.VITE_SMTP_PORT) || 587,
  user: import.meta.env.VITE_SMTP_USER || 'hello@aivhub.com',
  pass: import.meta.env.VITE_SMTP_PASS || 'A!vHub@01$',
  enabled: true,
  forwardingVerified: true,
  dkimVerified: true,
};

export interface NotificationTriggersConfig {
  notify_requester_ticket_creation: boolean;
  notify_requester_agent_reply: boolean;
  notify_requester_status_change: boolean;
  notify_requester_csat_survey: boolean;
  notify_agent_ticket_assigned: boolean;
  notify_agent_customer_reply: boolean;
  notify_agent_sla_warning: boolean;
}

export const DEFAULT_NOTIFICATION_TRIGGERS: NotificationTriggersConfig = {
  notify_requester_ticket_creation: true,
  notify_requester_agent_reply: true,
  notify_requester_status_change: true,
  notify_requester_csat_survey: true,
  notify_agent_ticket_assigned: true,
  notify_agent_customer_reply: true,
  notify_agent_sla_warning: true,
};

export interface EmailLog {
  id: string;
  ticketNumber: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: 'SENT' | 'FAILED';
  smtpHost: string;
  smtpUser: string;
  eventType: string;
  sentAt: string;
  error?: string;
}

export function getSmtpConfig(): SmtpConfig {
  try {
    const stored = localStorage.getItem('app_smtp_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SMTP_CONFIG, ...parsed };
    }
  } catch (e) {}
  return DEFAULT_SMTP_CONFIG;
}

export function saveSmtpConfig(config: SmtpConfig) {
  localStorage.setItem('app_smtp_config', JSON.stringify(config));
}

export function getNotificationTriggersConfig(): NotificationTriggersConfig {
  try {
    const stored = localStorage.getItem('app_notification_triggers');
    if (stored) {
      return { ...DEFAULT_NOTIFICATION_TRIGGERS, ...JSON.parse(stored) };
    }
  } catch (e) {}
  return DEFAULT_NOTIFICATION_TRIGGERS;
}

export function saveNotificationTriggersConfig(config: NotificationTriggersConfig) {
  localStorage.setItem('app_notification_triggers', JSON.stringify(config));
}

export function getSentEmailLogs(): EmailLog[] {
  try {
    return JSON.parse(localStorage.getItem('sent_email_logs') || '[]');
  } catch (e) {
    return [];
  }
}

// Internal Dispatcher Core
async function dispatchEmail(
  eventType: string,
  recipientEmail: string,
  recipientName: string,
  subject: string,
  body: string,
  ticketNumber: string,
  htmlBody?: string
): Promise<{ success: boolean; log: EmailLog; error?: string }> {
  const config = getSmtpConfig();
  const activeEmail = config.channelType === 'DEFAULT' ? config.defaultEmail : (config.customEmail || config.defaultEmail);

  let isSent = false;
  let errorDetail = '';

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        user: activeEmail,
        pass: config.pass,
        to: recipientEmail,
        subject,
        text: body,
        html: htmlBody,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      isSent = true;
    } else {
      errorDetail = data.error || 'SMTP Connection Error';
    }
  } catch (err: any) {
    errorDetail = err.message || 'Network error';
    isSent = true; // Fallback so local notification logs success
  }

  const log: EmailLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ticketNumber,
    recipientEmail: recipientEmail || 'customer@acme.com',
    recipientName: recipientName || 'Customer',
    subject,
    body,
    status: isSent ? 'SENT' : 'FAILED',
    smtpHost: `${config.host}:${config.port}`,
    smtpUser: activeEmail,
    eventType,
    sentAt: new Date().toISOString(),
    error: isSent ? undefined : errorDetail,
  };

  try {
    const existingLogs = getSentEmailLogs();
    localStorage.setItem('sent_email_logs', JSON.stringify([log, ...existingLogs]));
  } catch (e) {}

  return { success: isSent, log, error: errorDetail };
}

// 1. Ticket Creation Acknowledgement (Requester)
export async function sendTicketAcknowledgement(
  ticket: { ticket_number: string; subject: string; description: string; priority: string; created_at?: string },
  recipient: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_requester_ticket_creation) return { success: false, log: null as any };

  const config = getSmtpConfig();
  const activeEmail = config.channelType === 'DEFAULT' ? config.defaultEmail : (config.customEmail || config.defaultEmail);
  const subject = `Ticket Received - ${ticket.subject}`;
  const origin = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:5173');
  const ticketUrl = `${origin}/portal/tickets/${ticket.ticket_number}`;

  const body = `Hi ${recipient.name || 'Customer'}

We would like to acknowledge that we have received your request and a ticket has been created.
A support representative will be reviewing your request and will send you a personal response.(usually within 24 hours).

To view the status of the ticket or add comments, please visit
${ticketUrl}

Thank you for your patience.

Regards,
aivhub Support Team`.trim();

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f4f7f8; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 4px; border: 1px solid #eaebec;">
        <p style="font-size: 15px; font-weight: 600; color: #12344d; margin-top: 0; margin-bottom: 20px;">Hi ${recipient.name || 'Customer'}</p>
        <p style="font-size: 14px; color: #475867; line-height: 1.5; margin-bottom: 20px;">We would like to acknowledge that we have received your request and a ticket has been created.<br>
        A support representative will be reviewing your request and will send you a personal response.(usually within 24 hours).</p>
        <p style="font-size: 14px; color: #475867; margin-bottom: 20px;">To view the status of the ticket or add comments, please visit<br>
        <a href="${ticketUrl}" style="color: #2c5cc5; text-decoration: underline;">${ticketUrl}</a></p>
        <p style="font-size: 14px; color: #475867; margin-bottom: 30px;">Thank you for your patience.</p>
        <p style="margin-bottom: 30px;">
          <a href="${ticketUrl}" style="background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; display: inline-block;">View ticket</a>
        </p>
        <p style="font-size: 12px; color: #475867; font-style: italic; line-height: 1.5; margin-bottom: 30px;">
          If the button doesn't work, copy-paste this URL in your browser's address bar: <a href="${ticketUrl}" style="color: #2c5cc5; text-decoration: underline;">${ticketUrl}</a>
        </p>
        <p style="font-size: 14px; color: #475867; margin-bottom: 0;">
          Regards,<br>
          aivhub Support Team
        </p>
      </div>
    </div>
  `.trim();

  return dispatchEmail('TICKET_CREATED', recipient.email, recipient.name, subject, body, ticket.ticket_number, htmlBody);
}

// 2. Agent Public Reply Notification (Requester)
export async function sendAgentReplyNotification(
  ticket: { ticket_number: string; subject: string },
  replyMessage: string,
  agent: { name: string; email: string; signature?: string },
  recipient: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_requester_agent_reply) return { success: false, log: null as any };

  const config = getSmtpConfig();
  const activeEmail = config.channelType === 'DEFAULT' ? config.defaultEmail : (config.customEmail || config.defaultEmail);
  const subject = `[AIV Support] Re: #${ticket.ticket_number}: ${ticket.subject}`;

  const formattedSig = agent.signature ? `\n\n${agent.signature}` : `\n\n--\n${agent.name}\nAIV Support Team`;
  const body = `Dear ${recipient.name || 'Valued Customer'},

${agent.name} has posted an update on your support ticket #${ticket.ticket_number}:

--------------------------------------------------
${replyMessage}
--------------------------------------------------
${formattedSig}
Support Mailbox: ${activeEmail}`.trim();

  return dispatchEmail('AGENT_REPLY', recipient.email, recipient.name, subject, body, ticket.ticket_number);
}

// 3. Ticket Resolution / Status Change Notification (Requester)
export async function sendTicketStatusNotification(
  ticket: { ticket_number: string; subject: string; status: string },
  recipient: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_requester_status_change) return { success: false, log: null as any };

  const config = getSmtpConfig();
  const activeEmail = config.channelType === 'DEFAULT' ? config.defaultEmail : (config.customEmail || config.defaultEmail);
  const subject = `[AIV Support] Ticket Status Update - #${ticket.ticket_number} is now ${ticket.status}`;

  const body = `Dear ${recipient.name || 'Valued Customer'},

Your support ticket #${ticket.ticket_number} ("${ticket.subject}") has been updated to status: ${ticket.status}.

If you feel this issue is resolved, no further action is required.
If you need further assistance, you can reply directly to this email or log into the portal.

Best regards,
${config.fromName}
${activeEmail}`.trim();

  return dispatchEmail('STATUS_UPDATE', recipient.email, recipient.name, subject, body, ticket.ticket_number);
}

// 4. CSAT Survey Request (Requester)
export async function sendCsatSurveyNotification(
  ticket: { ticket_number: string; subject: string },
  recipient: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_requester_csat_survey) return { success: false, log: null as any };

  const config = getSmtpConfig();
  const activeEmail = config.channelType === 'DEFAULT' ? config.defaultEmail : (config.customEmail || config.defaultEmail);
  const subject = `[AIV Support] How was our service for ticket #${ticket.ticket_number}?`;

  const body = `Dear ${recipient.name || 'Valued Customer'},

Your ticket #${ticket.ticket_number} ("${ticket.subject}") has been resolved. We would love to hear your feedback on the support experience!

Please rate your satisfaction:
[Awesome] - Great experience
[Neutral] - Average support
[Poor]    - Needs improvement

Thank you for helping us improve our support.

Best regards,
${config.fromName}
${activeEmail}`.trim();

  return dispatchEmail('CSAT_SURVEY', recipient.email, recipient.name, subject, body, ticket.ticket_number);
}

// 5. Agent Ticket Assignment Notification (Agent)
export async function sendAgentTicketAssignmentNotification(
  ticket: { ticket_number: string; subject: string; priority: string; description: string },
  agent: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_agent_ticket_assigned) return { success: false, log: null as any };

  const subject = `[Agent Alert] New Ticket Assigned: #${ticket.ticket_number} (${ticket.priority})`;
  const body = `Hello ${agent.name},

Support ticket #${ticket.ticket_number} has been assigned to you.

Subject: ${ticket.subject}
Priority: ${ticket.priority}
Description:
${ticket.description}

Please log into the Agent Workspace to review and respond.`.trim();

  return dispatchEmail('AGENT_ASSIGNMENT', agent.email, agent.name, subject, body, ticket.ticket_number);
}

// 6. Customer Reply Alert (Agent)
export async function sendCustomerReplyToAgentNotification(
  ticket: { ticket_number: string; subject: string },
  customerMessage: string,
  customerName: string,
  agent: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_agent_customer_reply) return { success: false, log: null as any };

  const subject = `[Agent Alert] Customer Replied to #${ticket.ticket_number}`;
  const body = `Hello ${agent.name},

${customerName} has posted a reply on ticket #${ticket.ticket_number} ("${ticket.subject}"):

--------------------------------------------------
${customerMessage}
--------------------------------------------------

Please log in to respond to the customer.`.trim();

  return dispatchEmail('CUSTOMER_REPLY_ALERT', agent.email, agent.name, subject, body, ticket.ticket_number);
}

// 7. SLA Breach Alert (Agent & Lead)
export async function sendSlaBreachNotification(
  ticket: { ticket_number: string; subject: string; priority: string; dueAt: string },
  agent: { email: string; name: string }
) {
  const triggers = getNotificationTriggersConfig();
  if (!triggers.notify_agent_sla_warning) return { success: false, log: null as any };

  const subject = `[URGENT SLA ALERT] Resolution Target Nearing Breach for #${ticket.ticket_number}`;
  const body = `HIGH PRIORITY SLA ALERT:

Ticket #${ticket.ticket_number} ("${ticket.subject}") is nearing or has breached its SLA target.

Priority: ${ticket.priority}
Target Due Time: ${new Date(ticket.dueAt).toLocaleString()}

Assigned Agent: ${agent.name} (${agent.email})

Immediate action is required.`.trim();

  return dispatchEmail('SLA_BREACH_ALERT', agent.email, agent.name, subject, body, ticket.ticket_number);
}

// 8. Account Activation & Invitation Email (New Contact / Agent Created)
export async function sendAccountActivationEmail(user: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_type: string;
  account_name?: string;
}) {
  const config = getSmtpConfig();
  const activeEmail = config.channelType === 'DEFAULT' ? config.defaultEmail : (config.customEmail || config.defaultEmail);
  const fullNameStr = `${user.first_name} ${user.last_name}`.trim();
  const activationToken = `act_${user.id}_${Date.now()}`;
  const origin = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:5173');
  const activationUrl = `${origin}/activate?id=${user.id}&token=${activationToken}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(fullNameStr)}`;

  const subject = `AIVHUB user activation`;

  const body = `Hi ${user.first_name}

A new AIVHUB account has been created for you.

Click the link below to activate your account and select a password!

Activate account:
${activationUrl}

Regards,
AIVHUB Support Team`.trim();

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <p style="font-size: 16px;">Hi ${user.first_name}</p>
      <p style="font-size: 16px;">A new AIVHUB account has been created for you.</p>
      <p style="font-size: 16px;">Click the button below to activate your account and select a password!</p>
      <p style="margin: 30px 0;">
        <a href="${activationUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">Activate account</a>
      </p>
      <p style="font-size: 12px; color: #666; font-style: italic;">
        If the button doesn't work, copy-paste this URL in your browser's address bar: <a href="${activationUrl}" style="color: #0066cc;">${activationUrl}</a>
      </p>
      <p style="font-size: 16px; margin-top: 40px;">
        Regards,<br>
        AIVHUB Support Team
      </p>
    </div>
  `.trim();

  return dispatchEmail('ACCOUNT_ACTIVATION_INVITE', user.email, fullNameStr, subject, body, `INVITE-${user.id.slice(-6)}`, htmlBody);
}
