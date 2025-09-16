/** @jest-environment jsdom */
const React = require('react');
const { render, screen, fireEvent } = require('@testing-library/react');
const { ThemeProvider, createTheme } = require('@mui/material/styles');
const ShiftCalendar = require('../components/ShiftCalendar').default;

function renderWithTheme(ui) {
  const theme = createTheme();
  return render(React.createElement(ThemeProvider, { theme }, ui));
}

describe('ShiftCalendar UI toggles', () => {
  test('Today/Week/Month toggles update header', () => {
    renderWithTheme(React.createElement(ShiftCalendar, { shifts: [] }));

    const todayBtn = screen.getByRole('button', { name: /today/i });
    fireEvent.click(todayBtn);
    expect(screen.getByText(/,\s*\d{4}$/)).toBeInTheDocument();

    const weekToggle = screen.getByRole('button', { name: /week/i });
    fireEvent.click(weekToggle);
    expect(screen.getByText(/^Week of /)).toBeInTheDocument();

    const monthToggle = screen.getByRole('button', { name: /month/i });
    fireEvent.click(monthToggle);
    expect(screen.getByText(/\w+\s+\d{4}$/)).toBeInTheDocument();
  });
});
