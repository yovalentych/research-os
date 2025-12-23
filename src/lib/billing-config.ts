export type PlanConfig = {
  id: string;
  label: string;
  description: string;
  priceLabel: string;
  features: string[];
  limits: {
    projects: number | null;
    filesBytes: number | null;
  };
};

export const BILLING_PLANS: PlanConfig[] = [
  {
    id: "free",
    label: "Free",
    priceLabel: "0",
    description: "Старт без оплати для індивідуальних досліджень.",
    features: [
      "1 основний проєкт",
      "До 1 GB файлів",
      "База знань, Milestones, Манускрипти",
      "Експорт PDF/DOCX",
    ],
    limits: {
      projects: 1,
      filesBytes: 1 * 1024 * 1024 * 1024,
    },
  },
  {
    id: "pro",
    label: "Pro",
    priceLabel: "9€ / міс",
    description: "Для активних дослідників і команд до 3 осіб.",
    features: [
      "10 проєктів",
      "До 25 GB файлів",
      "Спільний доступ і історія змін",
      "Шаблони документів",
    ],
    limits: {
      projects: 10,
      filesBytes: 25 * 1024 * 1024 * 1024,
    },
  },
  {
    id: "lab",
    label: "Lab",
    priceLabel: "29€ / міс",
    description: "Лабораторії з кількома командами та аудитом.",
    features: [
      "Необмежені проєкти",
      "До 200 GB файлів",
      "Командні ролі та логи",
      "Пріоритетна підтримка",
    ],
    limits: {
      projects: null,
      filesBytes: 200 * 1024 * 1024 * 1024,
    },
  },
];

export function getPlanConfig(planId: string) {
  return BILLING_PLANS.find((plan) => plan.id === planId) ?? BILLING_PLANS[0];
}
