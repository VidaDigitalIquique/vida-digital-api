import { fireEvent, render, screen } from '@testing-library/react';
import { CompanySwitcher } from '../CompanySwitcher';
import { Sheet, SheetContent } from '@/components/ui/sheet';

describe('CompanySwitcher within Sheet', () => {
  test('opens dropdown inside a Sheet without closing immediately', async () => {
    render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent>
          <CompanySwitcher activeEmpresaId={1} onSwitch={() => {}} />
        </SheetContent>
      </Sheet>
    );

    fireEvent.click(screen.getByText('SANJH'));
    expect(await screen.findByText('VIDA DIGITAL')).toBeInTheDocument();
  });
});
