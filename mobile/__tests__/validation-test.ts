import {
  cleanAddress,
  normalizePhone,
  splitFullName,
  validateAddress,
  validateLogin,
  validateRegistration,
  type AddressValues,
} from '@/utils/validation';

const valid = { fullName: 'Ali Raza', email: 'ali@example.com', phone: '0300-111 2233', password: 'Grocery#2026', confirmPassword: 'Grocery#2026' };

describe('registration', () => {
  it('accepts a complete form (phone is optional)', () => {
    expect(validateRegistration(valid)).toEqual({});
    expect(validateRegistration({ ...valid, phone: '' })).toEqual({});
  });

  it('explains every problem', () => {
    expect(validateRegistration({ fullName: ' ', email: 'ali@', phone: '12', password: '1234567', confirmPassword: 'x' })).toEqual({
      fullName: 'Enter your name.',
      email: 'Enter a valid email address.',
      phone: 'Enter a valid phone number, e.g. 03001234567 or +923001234567.',
      password: 'Use at least 8 characters.',
      confirmPassword: "Passwords don't match.",
    });
    expect(validateRegistration({ ...valid, password: '12345678', confirmPassword: '12345678' }).password).toBe("A password can't be only numbers.");
    expect(validateRegistration({ ...valid, confirmPassword: '' }).confirmPassword).toBe('Enter the password again.');
    expect(validateRegistration({ ...valid, email: '' }).email).toBe('Enter your email address.');
  });

  it('splits the full name into the API fields', () => {
    expect(splitFullName('  Muhammad   Ali  Khan ')).toEqual({ firstName: 'Muhammad', lastName: 'Ali Khan' });
    expect(splitFullName('Sara')).toEqual({ firstName: 'Sara', lastName: '' });
  });

  it('normalises phone numbers like the server', () => {
    expect(normalizePhone(' 0300-111 2233 ')).toBe('03001112233');
    expect(normalizePhone('+92 300 1112233')).toBe('+923001112233');
  });
});

it('login needs an email and a password', () => {
  expect(validateLogin('', '')).toEqual({ email: 'Enter your email address.', password: 'Enter your password.' });
  expect(validateLogin('ali@example.com', 'x')).toEqual({});
});

describe('address', () => {
  const address: AddressValues = {
    label: 'Home', recipientName: 'Ali Raza', phone: '0300 111 2233', line1: 'House 12', line2: '', area: 'Gulberg', city: 'Lahore', postalCode: '', instructions: '',
  };

  it('requires recipient, phone, street, area and city', () => {
    expect(validateAddress(address)).toEqual({});
    expect(validateAddress({ ...address, recipientName: '', phone: '', line1: ' ', area: '', city: '' })).toEqual({
      recipientName: "Enter the recipient's name.",
      phone: 'Enter a phone number.',
      line1: 'Enter the house and street.',
      area: 'Enter the area.',
      city: 'Enter the city.',
    });
  });

  it('applies the server length limits', () => {
    expect(validateAddress({ ...address, label: 'x'.repeat(31), postalCode: '12345678901' })).toEqual({
      label: 'Use at most 30 characters.',
      postalCode: 'Use at most 10 characters.',
    });
  });

  it('sends trimmed values and a normalised phone', () => {
    expect(cleanAddress({ ...address, line1: ' House 12 ' })).toMatchObject({ line1: 'House 12', phone: '03001112233' });
  });
});
