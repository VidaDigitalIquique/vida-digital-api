import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompanySwitcher } from '../CompanySwitcher';
import { Sheet, SheetContent } from '@/components/ui/sheet';

// El Sheet es controlado por el padre; el harness reproduce ese contrato real.
function Harness({ onSwitch }: { onSwitch: (id: number) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <CompanySwitcher
          activeEmpresaId={1}
          onSwitch={(id) => { onSwitch(id); setOpen(false); }}
        />
      </SheetContent>
    </Sheet>
  );
}

describe('CompanySwitcher within Sheet', () => {
  test('clicking trigger keeps Sheet open and opens dropdown', async () => {
    render(<Harness onSwitch={() => {}} />);

    fireEvent.click(screen.getByText('SANJH'));
    expect(await screen.findByText('VIDA DIGITAL')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeInTheDocument();
  });

  test('clicking item calls onSwitch and closes Sheet', async () => {
    const onSwitch = jest.fn();
    render(<Harness onSwitch={onSwitch} />);

    fireEvent.click(screen.getByText('SANJH'));
    const item = await screen.findByText('VIDA DIGITAL');
    fireEvent.click(item);
    expect(onSwitch).toHaveBeenCalledWith(2);
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
  });
});
