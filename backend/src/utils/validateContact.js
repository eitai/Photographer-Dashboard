const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates contact form fields shared across the public contact routes.
 * Returns null if valid, or an error message string if invalid.
 */
const validateContact = ({ name, email, phone, sessionType, message }) => {
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100)
    return 'Name is required and must be under 100 characters';

  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254)
      return 'Invalid email address';
  }

  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string' || phone.length > 30)
      return 'Phone must be under 30 characters';
  }

  if (sessionType !== undefined && sessionType !== null && sessionType !== '') {
    if (typeof sessionType !== 'string' || sessionType.length > 100)
      return 'Session type must be under 100 characters';
  }

  if (message !== undefined && message !== null && message !== '') {
    if (typeof message !== 'string' || message.length > 3000)
      return 'Message must be under 3000 characters';
  }

  return null;
};

module.exports = validateContact;
