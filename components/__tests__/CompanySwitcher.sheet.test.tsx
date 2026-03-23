import { fireEvent, render, screen } from '@testing-library/react';
import { CompanySwitcher } from '../CompanySwitcher';
import { Sheet, SheetContent } from '@/components/ui/sheet';

describe('CompanySwitcher within Sheet', () => {
  test('clicking trigger keeps Sheet open and opens dropdown', async () => {
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent>
          <CompanySwitcher activeEmpresaId={1} onSwitch={() => {}} />
        </SheetContent>
      </Sheet>
    );

    fireEvent.click(screen.getByText('SANJH'));
    expect(await screen.findByText('VIDA DIGITAL')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeInTheDocument();
  });

  test('clicking item calls onSwitch and closes Sheet', async () => {
    const onSwitch = jest.fn();
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent>
          <CompanySwitcher activeEmpresaId={1} onSwitch={onSwitch} />
        </SheetContent>
      </Sheet>
    );

    fireEvent.click(screen.getByText('SANJH'));
    const item = await screen.findByText('VIDA DIGITAL');
    fireEvent.click(item);
    expect(onSwitch).toHaveBeenCalledWith(2);
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
  });
});
