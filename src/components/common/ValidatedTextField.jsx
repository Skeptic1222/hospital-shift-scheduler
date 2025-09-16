import { useState, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  FormHelperText,
  Box,
  LinearProgress,
  Typography,
  Collapse,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
  Clear as ClearIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { validateField, sanitizeInput, checkPasswordStrength } from '../../utils/validation';

const ValidatedTextField = ({
  label,
  value,
  onChange,
  onBlur,
  validationType,
  validationRules = {},
  required = false,
  type = 'text',
  autoComplete,
  placeholder,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  multiline = false,
  rows = 1,
  maxRows,
  showValidationIcon = true,
  showClearButton = false,
  showPasswordStrength = false,
  helperText,
  sanitize = true,
  realTimeValidation = true,
  debounceMs = 300,
  sx = {},
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(value || '');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [debounceTimer, setDebounceTimer] = useState(null);

  // Sync with external value
  useEffect(() => {
    if (value !== undefined && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  // Validation effect
  useEffect(() => {
    if (touched && realTimeValidation) {
      clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        performValidation(internalValue);
      }, debounceMs);
      setDebounceTimer(timer);
    }

    return () => clearTimeout(debounceTimer);
  }, [internalValue, touched, validationType, validationRules]);

  const performValidation = (val) => {
    setIsValidating(true);
    
    const rules = {
      ...validationRules,
      required
    };
    
    const result = validateField(val, validationType, rules);
    setError(result.valid ? '' : result.message);
    
    // Check password strength if applicable
    if (validationType === 'password' && showPasswordStrength && val) {
      const strength = checkPasswordStrength(val);
      setPasswordStrength(strength);
    }
    
    setIsValidating(false);
  };

  const handleChange = (event) => {
    let newValue = event.target.value;
    
    // Apply sanitization if enabled
    if (sanitize && sanitizeInput[validationType]) {
      newValue = sanitizeInput[validationType](newValue);
    }
    
    setInternalValue(newValue);
    
    // Call external onChange if provided
    if (onChange) {
      const syntheticEvent = {
        ...event,
        target: { ...event.target, value: newValue }
      };
      onChange(syntheticEvent);
    }
  };

  const handleBlur = (event) => {
    setTouched(true);
    performValidation(internalValue);
    
    if (onBlur) {
      onBlur(event);
    }
  };

  const handleClear = () => {
    setInternalValue('');
    setError('');
    setPasswordStrength(null);
    
    if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Determine field state
  const hasError = touched && error;
  const isValid = touched && !error && internalValue;
  
  // Build end adornment
  const endAdornment = (
    <InputAdornment position="end">
      {isValidating && (
        <CircularProgress size={20} sx={{ mr: 1 }} />
      )}
      {!isValidating && showValidationIcon && isValid && (
        <ValidIcon color="success" sx={{ mr: 1 }} />
      )}
      {!isValidating && showValidationIcon && hasError && (
        <ErrorIcon color="error" sx={{ mr: 1 }} />
      )}
      {showClearButton && internalValue && !disabled && (
        <IconButton
          size="small"
          onClick={handleClear}
          edge="end"
          disabled={disabled}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
      {type === 'password' && (
        <IconButton
          size="small"
          onClick={togglePasswordVisibility}
          edge="end"
          disabled={disabled}
        >
          {showPassword ? <HideIcon /> : <ShowIcon />}
        </IconButton>
      )}
    </InputAdornment>
  );

  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto', ...sx }}>
      <TextField
        label={label}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        error={hasError}
        helperText={hasError ? error : helperText}
        type={type === 'password' && !showPassword ? 'password' : 'text'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth={fullWidth}
        size={size}
        multiline={multiline}
        rows={rows}
        maxRows={maxRows}
        required={required}
        InputProps={{
          endAdornment: endAdornment
        }}
        {...props}
      />
      
      {/* Password strength indicator */}
      {showPasswordStrength && type === 'password' && passwordStrength && internalValue && (
        <Collapse in={true}>
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Password Strength:
              </Typography>
              <Typography 
                variant="caption" 
                color={`${passwordStrength.color}.main`}
                sx={{ fontWeight: 600 }}
              >
                {passwordStrength.level}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={passwordStrength.score * 20}
              color={passwordStrength.color}
              sx={{ height: 4, borderRadius: 2 }}
            />
            <Box sx={{ mt: 0.5 }}>
              {Object.entries(passwordStrength.checks).map(([check, passed]) => (
                <Box
                  key={check}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    mr: 2,
                    opacity: passed ? 1 : 0.5
                  }}
                >
                  {passed ? (
                    <ValidIcon sx={{ fontSize: 14, color: 'success.main', mr: 0.5 }} />
                  ) : (
                    <ErrorIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 0.5 }} />
                  )}
                  <Typography
                    variant="caption"
                    color={passed ? 'success.main' : 'text.disabled'}
                  >
                    {check === 'length' && 'Length 8+'}
                    {check === 'lowercase' && 'Lowercase'}
                    {check === 'uppercase' && 'Uppercase'}
                    {check === 'numbers' && 'Number'}
                    {check === 'special' && 'Special'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Collapse>
      )}
      
      {/* Additional validation hints */}
      {!hasError && validationRules.hint && touched && (
        <FormHelperText sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <InfoIcon sx={{ fontSize: 14, mr: 0.5 }} />
          {validationRules.hint}
        </FormHelperText>
      )}
    </Box>
  );
};

export default ValidatedTextField;