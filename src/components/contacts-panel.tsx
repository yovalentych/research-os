'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

type ContactUser = {
  id: string;
  fullName?: string;
  email?: string;
  organizationName?: string;
  degreeCompleted?: string;
};

type ContactRequestStatus = 'pending' | 'accepted' | 'declined' | string;

type ContactRequestItem = {
  id: string;
  status: ContactRequestStatus;
  createdAt?: string;
  user: ContactUser | null;
};

type Contact = {
  id: string;
  since?: string;
  user: ContactUser | null;
};

function formatUserLabel(user?: ContactUser | null) {
  if (!user) return 'Користувач';
  return user.fullName || user.email || 'Користувач';
}

function formatUserMeta(user?: ContactUser | null) {
  if (!user) return '';
  const parts: string[] = [];
  if (user.email) parts.push(user.email);
  if (user.degreeCompleted) parts.push(user.degreeCompleted);
  if (user.organizationName) parts.push(user.organizationName);
  return parts.join(' · ');
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function ContactsPanel() {
  const searchInputId = useId();

  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);
  const hasQuery = debouncedQuery.length >= 2;

  const [results, setResults] = useState<ContactUser[]>([]);
  const [incoming, setIncoming] = useState<ContactRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<ContactRequestItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const messageTimerRef = useRef<number | null>(null);

  const setFlashMessage = useCallback((text: string | null) => {
    setMessage(text);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    if (text) {
      messageTimerRef.current = window.setTimeout(() => setMessage(null), 3500);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingLists(true);
    try {
      const response = await fetch('/api/contacts/requests');
      if (!response.ok) {
        setFlashMessage('Не вдалося завантажити контакти');
        return;
      }
      const data = (await readJsonSafe(response)) ?? {};
      setIncoming(Array.isArray(data.incoming) ? data.incoming : []);
      setOutgoing(Array.isArray(data.outgoing) ? data.outgoing : []);
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch {
      setFlashMessage('Помилка мережі при завантаженні контактів');
    } finally {
      setLoadingLists(false);
    }
  }, [setFlashMessage]);

  useEffect(() => {
    loadRequests();
    return () => {
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, [loadRequests]);

  useEffect(() => {
    // очистка результатів якщо запит короткий
    if (!hasQuery) {
      setResults([]);
      setLoadingSearch(false);
      if (searchAbortRef.current) searchAbortRef.current.abort();
      return;
    }

    // abort попереднього пошуку
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const run = async () => {
      setLoadingSearch(true);
      try {
        const response = await fetch(
          `/api/contacts/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          // не спамимо повідомленням на кожен невдалий пошук
          setResults([]);
          return;
        }

        const data = await readJsonSafe(response);
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        // Abort — це нормальна поведінка, не показуємо як помилку
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setResults([]);
      } finally {
        // якщо вже є новий controller — цей ефект старий, не чіпаємо loading
        if (searchAbortRef.current === controller) setLoadingSearch(false);
      }
    };

    run();

    return () => controller.abort();
  }, [debouncedQuery, hasQuery]);

  const resultCards = useMemo(() => results, [results]);

  const action = useCallback(
    async (id: string, fn: () => Promise<Response>, onOk?: () => void) => {
      setBusyId(id);
      setFlashMessage(null);
      try {
        const response = await fn();
        if (!response.ok) {
          const data = await readJsonSafe(response);
          setFlashMessage(data?.error ?? 'Не вдалося виконати дію');
          return;
        }
        onOk?.();
        await loadRequests();
      } catch {
        setFlashMessage('Помилка мережі');
      } finally {
        setBusyId(null);
      }
    },
    [loadRequests, setFlashMessage]
  );

  const handleInvite = useCallback(
    async (userId: string) => {
      await action(
        `invite:${userId}`,
        () =>
          fetch('/api/contacts/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }),
        () => {
          setFlashMessage('Запит надіслано');
          setQuery('');
          setResults([]);
        }
      );
    },
    [action, setFlashMessage]
  );

  const handleAccept = useCallback(
    async (requestId: string) => {
      await action(`accept:${requestId}`, () =>
        fetch(`/api/contacts/requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepted' }),
        })
      );
    },
    [action]
  );

  const handleDecline = useCallback(
    async (requestId: string) => {
      await action(`decline:${requestId}`, () =>
        fetch(`/api/contacts/requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'declined' }),
        })
      );
    },
    [action]
  );

  const handleCancel = useCallback(
    async (requestId: string) => {
      await action(`cancel:${requestId}`, () =>
        fetch(`/api/contacts/requests/${requestId}`, { method: 'DELETE' })
      );
    },
    [action]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Контакти</h3>
            <p className="mt-2 text-sm text-slate-600">
              Додавай знайомих, щоб швидко запрошувати у проєкти та колаборації.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRequests}
            disabled={loadingLists}
            className={cx(
              'rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold',
              loadingLists ? 'text-slate-400' : 'text-slate-600'
            )}
            aria-label="Оновити контакти"
            title="Оновити"
          >
            {loadingLists ? 'Оновлення...' : 'Оновити'}
          </button>
        </div>

        <div className="mt-4">
          <label
            htmlFor={searchInputId}
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Пошук користувачів
          </label>
          <input
            id={searchInputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ім'я, email, організація"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            autoComplete="off"
          />
          {trimmedQuery.length > 0 && trimmedQuery.length < 2 ? (
            <p className="mt-2 text-xs text-slate-500">
              Введи мінімум 2 символи.
            </p>
          ) : null}
          {loadingSearch ? (
            <p className="mt-2 text-xs text-slate-500">Пошук...</p>
          ) : null}
        </div>

        {hasQuery ? (
          <div className="mt-4 grid gap-3">
            {resultCards.length === 0 && !loadingSearch ? (
              <p className="text-xs text-slate-500">Нічого не знайдено.</p>
            ) : (
              resultCards.map((user) => {
                const isBusy = busyId === `invite:${user.id}`;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {formatUserLabel(user)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {formatUserMeta(user)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInvite(user.id)}
                      disabled={isBusy}
                      className={cx(
                        'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
                        isBusy
                          ? 'border-slate-200 text-slate-400'
                          : 'border-slate-200 text-slate-600 hover:bg-white'
                      )}
                    >
                      {isBusy ? '...' : 'Запросити'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 text-sm text-slate-600">{message}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Вхідні запити
            </p>
            <div className="mt-3 space-y-2">
              {incoming.length === 0 ? (
                <p className="text-xs text-slate-500">Немає нових запитів.</p>
              ) : (
                incoming.map((item) => {
                  const isAcceptBusy = busyId === `accept:${item.id}`;
                  const isDeclineBusy = busyId === `decline:${item.id}`;
                  const anyBusy = isAcceptBusy || isDeclineBusy;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {formatUserLabel(item.user)}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAccept(item.id)}
                            disabled={anyBusy}
                            className={cx(
                              'rounded-full border px-3 py-1 text-[11px] font-semibold',
                              anyBusy
                                ? 'border-slate-200 text-slate-400'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            )}
                          >
                            {isAcceptBusy ? '...' : 'Прийняти'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecline(item.id)}
                            disabled={anyBusy}
                            className={cx(
                              'rounded-full border px-3 py-1 text-[11px] font-semibold',
                              anyBusy
                                ? 'border-slate-200 text-slate-400'
                                : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                            )}
                          >
                            {isDeclineBusy ? '...' : 'Відхилити'}
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatUserMeta(item.user)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Надіслані запити
            </p>
            <div className="mt-3 space-y-2">
              {outgoing.length === 0 ? (
                <p className="text-xs text-slate-500">Немає очікувань.</p>
              ) : (
                outgoing.map((item) => {
                  const isBusy = busyId === `cancel:${item.id}`;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {formatUserLabel(item.user)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancel(item.id)}
                          disabled={isBusy}
                          className={cx(
                            'rounded-full border px-3 py-1 text-[11px] font-semibold',
                            isBusy
                              ? 'border-slate-200 text-slate-400'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          )}
                        >
                          {isBusy ? '...' : 'Скасувати'}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatUserMeta(item.user)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Мої контакти
            </p>
            <div className="mt-3 space-y-2">
              {contacts.length === 0 ? (
                <p className="text-xs text-slate-500">Контактів поки немає.</p>
              ) : (
                contacts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    <p className="font-semibold">
                      {formatUserLabel(item.user)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatUserMeta(item.user)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
