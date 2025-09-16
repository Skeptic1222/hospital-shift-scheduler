// Common validation utilities for form inputs
import { useState, useEffect } from 'react';

export const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  phone: {
    pattern: /^(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
    message: 'Please enter a valid phone number (e.g., 555-555-5555)'
  },
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  },
  name: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    message: 'Name should only contain letters, spaces, hyphens, and apostrophes'
  },
  department: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s-]+$/,
    message: 'Department should only contain letters, numbers, spaces, and hyphens'
  },
  employeeId: {
    pattern: /^[A-Z0-9]{4,12}$/,
    message: 'Employee ID should be 4-12 characters (letters and numbers only)'
  },
  ssn: {
    pattern: /^\d{3}-\d{2}-\d{4}$/,
    message: 'SSN should be in format XXX-XX-XXXX'
  },
  zipCode: {
    pattern: /^\d{5}(-\d{4})?$/,
    message: 'Zip code should be 5 or 9 digits (e.g., 12345 or 12345-6789)'
  }
};

// Validation helper functions
export const validateField = (value, type, customRules = {}) => {
  const rules = { ...validationRules[type], ...customRules };
  
  if (!value && rules.required) {
    return { valid: false, message: 'This field is required' };
  }
  
  if (value && rules.minLength && value.length < rules.minLength) {
    return { 
      valid: false, 
      message: `Must be at least ${rules.minLength} characters` 
    };
  }
  
  if (value && rules.maxLength && value.length > rules.maxLength) {
    return { 
      valid: false, 
      message: `Must be no more than ${rules.maxLength} characters` 
    };
  }
  
  if (value && rules.pattern && !rules.pattern.test(value)) {
    return { valid: false, message: rules.message };
  }
  
  if (value && rules.custom) {
    const customResult = rules.custom(value);
    if (!customResult.valid) {
      return customResult;
    }
  }
  
  return { valid: true, message: '' };
};

// Form-level validation
export const validateForm = (formData, schema) => {
  const errors = {};
  let isValid = true;
  
  Object.keys(schema).forEach(field => {
    const value = formData[field];
    const rules = schema[field];
    const result = validateField(value, rules.type, rules);
    
    if (!result.valid) {
      errors[field] = result.message;
      isValid = false;
    }
  });
  
  return { isValid, errors };
};

// Real-time validation hook
export const useFieldValidation = (value, type, rules = {}) => {
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  
  useEffect(() => {
    if (touched) {
      const result = validateField(value, type, rules);
      setError(result.valid ? '' : result.message);
    }
  }, [value, touched, type, rules]);
  
  const handleBlur = () => setTouched(true);
  
  return { error, handleBlur, isValid: !error && touched };
};

// Sanitization functions
export const sanitizeInput = {
  email: (value) => value.toLowerCase().trim(),
  phone: (value) => value.replace(/[^\d+()-.\s]/g, ''),
  name: (value) => value.trim().replace(/\s+/g, ' '),
  alphanumeric: (value) => value.replace(/[^a-zA-Z0-9\s]/g, ''),
  numeric: (value) => value.replace(/[^\d]/g, ''),
  ssn: (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  },
  zipCode: (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  }
};

// Password strength checker
export const checkPasswordStrength = (password) => {
  let strength = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[@$!%*?&]/.test(password)
  };
  
  Object.values(checks).forEach(passed => {
    if (passed) strength++;
  });
  
  const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['error', 'error', 'warning', 'info', 'success'];
  
  return {
    score: strength,
    level: levels[strength],
    color: colors[strength],
    checks
  };
};

// Common error messages
export const errorMessages = {
  required: 'This field is required',
  invalidEmail: 'Please enter a valid email address',
  invalidPhone: 'Please enter a valid phone number',
  passwordMismatch: 'Passwords do not match',
  weakPassword: 'Password is too weak',
  duplicateEntry: 'This value already exists',
  invalidDate: 'Please enter a valid date',
  futureDate: 'Date cannot be in the future',
  pastDate: 'Date cannot be in the past',
  invalidRange: 'End date must be after start date',
  fileSize: 'File size exceeds maximum allowed',
  fileType: 'Invalid file type',
  networkError: 'Network error. Please try again',
  serverError: 'Server error. Please contact support',
  unauthorized: 'You are not authorized to perform this action',
  sessionExpired: 'Your session has expired. Please log in again'
};

// Form state management helper
export const useFormState = (initialValues, validationSchema) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error on change if field was touched
    if (touched[field]) {
      const result = validateField(value, validationSchema[field].type, validationSchema[field]);
      setErrors(prev => ({ 
        ...prev, 
        [field]: result.valid ? '' : result.message 
      }));
    }
  };
  
  const handleBlur = (field) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const result = validateField(
      values[field], 
      validationSchema[field].type, 
      validationSchema[field]
    );
    setErrors(prev => ({ 
      ...prev, 
      [field]: result.valid ? '' : result.message 
    }));
  };
  
  const handleSubmit = async (onSubmit) => {
    // Mark all fields as touched
    const allTouched = Object.keys(validationSchema).reduce(
      (acc, field) => ({ ...acc, [field]: true }), 
      {}
    );
    setTouched(allTouched);
    
    // Validate all fields
    const validation = validateForm(values, validationSchema);
    setErrors(validation.errors);
    
    if (validation.isValid) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  };
  
  const isValid = Object.keys(errors).length === 0 && 
                  Object.keys(touched).length > 0;
  
  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setValues,
    setErrors
  };
};

export default {
  validationRules,
  validateField,
  validateForm,
  sanitizeInput,
  checkPasswordStrength,
  errorMessages,
  useFormState
};