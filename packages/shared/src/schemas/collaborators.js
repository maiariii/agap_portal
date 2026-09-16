/**
 * Collaborator Invite Schema
 * Validates payload for inviting helpers to collaborate within HRMO scope
 */
export const CollaboratorInviteSchema = {
  validate(data) {
    const errors = [];
    const { first_name, last_name, position, email } = data || {};

    if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
      errors.push('First name is required.');
    }
    if (!last_name || typeof last_name !== 'string' || !last_name.trim()) {
      errors.push('Last name is required.');
    }
    if (!position || typeof position !== 'string' || !position.trim()) {
      errors.push('Position is required.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.push('Email is required.');
    } else if (!emailRegex.test(email.trim())) {
      errors.push('A valid email address is required.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: {
        first_name: first_name?.trim() || '',
        last_name: last_name?.trim() || '',
        position: position?.trim() || '',
        email: email?.trim().toLowerCase() || ''
      }
    };
  },

  safeParse(data) {
    const res = this.validate(data);
    if (!res.isValid) {
      return {
        success: false,
        error: {
          issues: res.errors.map(message => ({ message }))
        }
      };
    }
    return {
      success: true,
      data: res.data
    };
  }
};
