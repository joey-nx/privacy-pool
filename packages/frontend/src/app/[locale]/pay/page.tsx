import { redirect } from "~i18n/navigation";

interface PayPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ npk?: string; enc?: string }>;
}

export default async function PayPage({ params, searchParams }: PayPageProps) {
  const { locale } = await params;
  const { npk, enc } = await searchParams;

  if (npk && enc) {
    redirect({
      href: { pathname: "/app", query: { tab: "send", npk, enc } },
      locale,
    });
  }

  redirect({ href: "/app", locale });
}
