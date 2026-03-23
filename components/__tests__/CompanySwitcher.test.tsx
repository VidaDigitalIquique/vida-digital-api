import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CompanySwitcher } from '../CompanySwitcher';

describe('CompanySwitcher', () => {
  test('smoke: renders trigger and is clickable', () => {
    render(<CompanySwitcher activeEmpresaId={1} onSwitch={() => {}} />);
    const trigger = screen.getByText('SANJH');
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);
  });

  test('opens dropdown on trigger click', async () => {
    render(<CompanySwitcher activeEmpresaId={1} onSwitch={() => {}} />);
    fireEvent.click(screen.getByText('SANJH'));
    expect(await screen.findByText('VIDA DIGITAL')).toBeInTheDocument();
  });

  test('selecting an item calls onSwitch and closes', async () => {
    const onSwitch = jest.fn();
    render(<CompanySwitcher activeEmpresaId={1} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByText('SANJH'));
    const item = await screen.findByText('VIDA DIGITAL');
    fireEvent.click(item);
    expect(onSwitch).toHaveBeenCalledWith(2);
    await waitFor(() => {
      expect(screen.queryByText('VIDA DIGITAL')).not.toBeInTheDocument();
    });
  });
});
