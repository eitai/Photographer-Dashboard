/**
 * Returns null if the password meets policy, or an error message string if not.
 * Policy: at least 8 characters, at least one letter, at least one digit.
 */
const validatePassword = (pw) => {
  if (typeof pw !== 'string') return 'Password must be a string';
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  return null;
};

module.exports = validatePassword;
