export interface CustomTicketField {
  id: string;
  label: string;
  type: 'TEXT' | 'DROPDOWN' | 'CHECKBOX' | 'NUMBER' | 'DATE' | 'TEXTAREA';
  options?: string[];
  is_system: boolean;
  required_agent: boolean;
  visible_customer: boolean;
  required_customer: boolean;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface TicketFormConfig {
  id: string;
  title: string;
  description: string;
  category_name: string;
  is_default: boolean;
  is_enabled: boolean;
  fields: string[];
  created_at: string;
}

export interface SlaTargetConfig {
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  response_minutes: number;
  resolution_minutes: number;
  clock_type: 'business' | 'calendar';
  pause_customer_wait: boolean;
}

export interface CustomSlaPolicy {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  targets: SlaTargetConfig[];
  created_at: string;
}

// PRE-SEEDED DEFAULT SYSTEM TICKET FIELDS
export const DEFAULT_TICKET_FIELDS: CustomTicketField[] = [
  { id: 'tf-1', label: 'Ticket Subject', type: 'TEXT', is_system: true, required_agent: true, visible_customer: true, required_customer: true, category: 'General', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-2', label: 'Detailed Description', type: 'TEXTAREA', is_system: true, required_agent: true, visible_customer: true, required_customer: true, category: 'General', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-3', label: 'Ticket Priority', type: 'DROPDOWN', options: ['P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low'], is_system: true, required_agent: true, visible_customer: true, required_customer: true, category: 'Routing', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-4', label: 'Ticket Status', type: 'DROPDOWN', options: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'], is_system: true, required_agent: true, visible_customer: true, required_customer: false, category: 'Routing', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-5', label: 'Impact Level', type: 'DROPDOWN', options: ['Entire Organisation', 'Multiple Users', 'Single User', 'Minor'], is_system: true, required_agent: false, visible_customer: true, required_customer: false, category: 'Classification', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-6', label: 'Urgency Level', type: 'DROPDOWN', options: ['Business Stopped', 'Major Disruption', 'Workaround Available', 'Minor'], is_system: true, required_agent: false, visible_customer: true, required_customer: false, category: 'Classification', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-7', label: 'Deployment Environment', type: 'DROPDOWN', options: ['Production', 'Staging', 'UAT / Test', 'Development'], is_system: true, required_agent: false, visible_customer: true, required_customer: false, category: 'Technical Details', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-8', label: 'AIV Product Version', type: 'TEXT', is_system: true, required_agent: false, visible_customer: true, required_customer: false, category: 'Technical Details', is_active: true, created_at: new Date().toISOString() },
  { id: 'tf-9', label: 'Customer Device / Serial Number', type: 'TEXT', is_system: false, required_agent: false, visible_customer: true, required_customer: false, category: 'Hardware Custom Field', is_active: true, created_at: new Date().toISOString() },
];

// PRE-SEEDED DEFAULT TICKET FORMS
export const DEFAULT_TICKET_FORMS: TicketFormConfig[] = [
  {
    id: 'form-1',
    title: 'Standard Technical Incident Form',
    description: 'Default ticket submission form for software bugs, system crashes, and technical support.',
    category_name: 'Technical Incident',
    is_default: true,
    is_enabled: true,
    fields: ['tf-1', 'tf-2', 'tf-3', 'tf-7', 'tf-8'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'form-2',
    title: 'Feature Request & Enhancement Form',
    description: 'Form for customer product feature suggestions and capability enhancements.',
    category_name: 'Feature Request',
    is_default: true,
    is_enabled: true,
    fields: ['tf-1', 'tf-2', 'tf-5'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'form-3',
    title: 'Account & Billing Support Form',
    description: 'Form for subscription inquiries, invoice receipts, and entitlement updates.',
    category_name: 'Billing & Account',
    is_default: true,
    is_enabled: true,
    fields: ['tf-1', 'tf-2', 'tf-3'],
    created_at: new Date().toISOString(),
  },
];

// PRE-SEEDED DEFAULT SLA POLICY
export const DEFAULT_SLA_POLICIES: CustomSlaPolicy[] = [
  {
    id: 'sla-default',
    name: 'Freshworks Default System SLA',
    description: 'Standard SLA targets for response time and ticket resolution across priority levels.',
    is_default: true,
    is_active: true,
    targets: [
      { priority: 'P1', response_minutes: 15, resolution_minutes: 120, clock_type: 'calendar', pause_customer_wait: true },
      { priority: 'P2', response_minutes: 60, resolution_minutes: 480, clock_type: 'business', pause_customer_wait: true },
      { priority: 'P3', response_minutes: 240, resolution_minutes: 1440, clock_type: 'business', pause_customer_wait: true },
      { priority: 'P4', response_minutes: 480, resolution_minutes: 2880, clock_type: 'business', pause_customer_wait: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'sla-platinum',
    name: 'Enterprise VIP Platinum 24x7 SLA',
    description: 'Ultra-fast SLA response targets for enterprise mission-critical contracts.',
    is_default: false,
    is_active: true,
    targets: [
      { priority: 'P1', response_minutes: 10, resolution_minutes: 60, clock_type: 'calendar', pause_customer_wait: true },
      { priority: 'P2', response_minutes: 30, resolution_minutes: 240, clock_type: 'calendar', pause_customer_wait: true },
      { priority: 'P3', response_minutes: 120, resolution_minutes: 720, clock_type: 'business', pause_customer_wait: true },
      { priority: 'P4', response_minutes: 240, resolution_minutes: 1440, clock_type: 'business', pause_customer_wait: true },
    ],
    created_at: new Date().toISOString(),
  },
];

// Local Storage Helper Functions

export function getStoredTicketFields(): CustomTicketField[] {
  try {
    const raw = localStorage.getItem('aiv_custom_ticket_fields');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  localStorage.setItem('aiv_custom_ticket_fields', JSON.stringify(DEFAULT_TICKET_FIELDS));
  return DEFAULT_TICKET_FIELDS;
}

export function saveTicketField(field: CustomTicketField): CustomTicketField[] {
  const current = getStoredTicketFields();
  const idx = current.findIndex((f) => f.id === field.id);
  let updated: CustomTicketField[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = field;
  } else {
    updated = [field, ...current];
  }
  localStorage.setItem('aiv_custom_ticket_fields', JSON.stringify(updated));
  return updated;
}

export function deleteTicketField(fieldId: string): CustomTicketField[] {
  const current = getStoredTicketFields();
  const updated = current.filter((f) => f.id !== fieldId || f.is_system);
  localStorage.setItem('aiv_custom_ticket_fields', JSON.stringify(updated));
  return updated;
}

export function getStoredTicketForms(): TicketFormConfig[] {
  try {
    const raw = localStorage.getItem('aiv_custom_ticket_forms');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  localStorage.setItem('aiv_custom_ticket_forms', JSON.stringify(DEFAULT_TICKET_FORMS));
  return DEFAULT_TICKET_FORMS;
}

export function saveTicketForm(form: TicketFormConfig): TicketFormConfig[] {
  const current = getStoredTicketForms();
  const idx = current.findIndex((f) => f.id === form.id);
  let updated: TicketFormConfig[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = form;
  } else {
    updated = [form, ...current];
  }
  localStorage.setItem('aiv_custom_ticket_forms', JSON.stringify(updated));
  return updated;
}

export function deleteTicketForm(formId: string): TicketFormConfig[] {
  const current = getStoredTicketForms();
  const updated = current.filter((f) => f.id !== formId || f.is_default);
  localStorage.setItem('aiv_custom_ticket_forms', JSON.stringify(updated));
  return updated;
}

export function getStoredSlaPolicies(): CustomSlaPolicy[] {
  try {
    const raw = localStorage.getItem('aiv_custom_sla_policies');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  localStorage.setItem('aiv_custom_sla_policies', JSON.stringify(DEFAULT_SLA_POLICIES));
  return DEFAULT_SLA_POLICIES;
}

export function saveSlaPolicy(policy: CustomSlaPolicy): CustomSlaPolicy[] {
  const current = getStoredSlaPolicies();
  const idx = current.findIndex((p) => p.id === policy.id);
  let updated: CustomSlaPolicy[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = policy;
  } else {
    updated = [policy, ...current];
  }
  localStorage.setItem('aiv_custom_sla_policies', JSON.stringify(updated));
  return updated;
}

export function deleteSlaPolicy(policyId: string): CustomSlaPolicy[] {
  const current = getStoredSlaPolicies();
  const updated = current.filter((p) => p.id !== policyId || p.is_default);
  localStorage.setItem('aiv_custom_sla_policies', JSON.stringify(updated));
  return updated;
}
