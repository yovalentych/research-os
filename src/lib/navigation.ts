export const navSections = [
  {
    id: 'core',
    title: 'Основне',
    items: [
      { id: 'dashboard', label: 'Панель', href: '', icon: 'LayoutDashboard' },
      {
        id: 'projects',
        label: 'Проєкти',
        href: 'projects',
        icon: 'FolderKanban',
      },
      {
        id: 'milestones',
        label: 'Milestones',
        href: 'milestones',
        icon: 'Flag',
      },
    ],
  },

  {
    id: 'finance',
    title: 'Фінанси',
    items: [
      { id: 'finance', label: 'Огляд', href: 'finance', icon: 'Wallet' },
      {
        id: 'finance-scholarships',
        label: 'Стипендія',
        href: 'finance/scholarships',
        icon: 'Coins',
      },
      {
        id: 'finance-grants',
        label: 'Гранти',
        href: 'finance/grants',
        icon: 'BadgeCheck',
      },
    ],
  },

  {
    id: 'research',
    title: 'Дослідження',
    items: [
      {
        id: 'academic-profile',
        label: 'Academic Profile',
        href: 'academic-profile',
        icon: 'GraduationCap',
      },
      {
        id: 'experiments',
        label: 'Експерименти',
        href: 'experiments',
        icon: 'FlaskConical',
      },
      {
        id: 'knowledge-base',
        label: 'База знань',
        href: 'knowledge-base',
        icon: 'Library',
      },
      { id: 'vault', label: 'Сховище', href: 'vault', icon: 'Vault' },
      { id: 'papers', label: 'Публікації', href: 'papers', icon: 'FileText' },
      {
        id: 'manuscripts',
        label: 'Манускрипт',
        href: 'manuscripts',
        icon: 'ScrollText',
      },
    ],
  },

  {
    id: 'admin',
    title: 'Адміністрування',
    items: [
      {
        id: 'profile',
        label: 'Профіль',
        href: 'settings/profile',
        icon: 'Users',
      },
      { id: 'contacts', label: 'Контакти', href: 'contacts', icon: 'Users' },
      { id: 'audit', label: 'Журнал змін', href: 'audit', icon: 'Activity' },
      {
        id: 'affiliations',
        label: 'Афіліація',
        href: 'affiliations',
        icon: 'Building2',
      },
      { id: 'archive', label: 'Архів', href: 'archive', icon: 'Archive' },
      {
        id: 'users',
        label: 'Користувачі',
        href: 'settings/users',
        icon: 'Users',
      },
      {
        id: 'org-sources',
        label: 'Реєстри',
        href: 'settings/organizations',
        icon: 'Building2',
      },
    ],
  },
];
