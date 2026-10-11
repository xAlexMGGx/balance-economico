import { Page } from './ui';

/** Placeholder for the sections of later phases. */
export function ComingSoon({ title, children }: { title: string; children: string }) {
  return (
    <Page>
      <div className="mt-10 rounded-2xl bg-surface px-6 py-10 text-center">
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1.5 text-sm text-muted">{children}</p>
      </div>
    </Page>
  );
}
