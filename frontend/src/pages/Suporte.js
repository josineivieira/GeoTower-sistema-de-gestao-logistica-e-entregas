import React from 'react';

const Suporte = () => {
  const handleBack = () => {
    window.history.back();
  };

  // Ajuste aqui os dados oficiais do suporte
  const whatsappNumber = '5592982760029';
  const whatsappDisplay = '(92) 98276-0029';
  const supportEmail = 'geotower@geotransportes.com.br';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="relative overflow-hidden">
        {/* Efeitos de fundo */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute top-10 right-0 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:shadow"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>

            <span className="hidden sm:inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm border border-slate-200">
              Central de Suporte
            </span>
          </div>

          {/* Hero */}
          <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white shadow-2xl">
            <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-8 p-6 sm:p-8 lg:p-10">
              <div>
                <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium border border-white/10 backdrop-blur">
                  Sistema GeoTower
                </div>

                <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight">
                  Suporte profissional para toda a operação da sua plataforma
                </h1>

                <p className="mt-4 max-w-2xl text-slate-200 text-sm sm:text-base leading-7">
                  Bem-vindo à Central de Suporte do <strong>Sistema GeoTower</strong>.
                  Nossa equipe está preparada para atender <strong>Administradores</strong>,
                  <strong> Contratados</strong> e <strong>Motoristas</strong> com rapidez,
                  clareza e segurança em dúvidas operacionais, dificuldades técnicas e orientações de uso.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.52 3.48A11.8 11.8 0 0 0 12.04 0C5.52 0 .22 5.3.22 11.82c0 2.08.54 4.11 1.58 5.9L0 24l6.48-1.7a11.8 11.8 0 0 0 5.56 1.42h.01c6.52 0 11.82-5.3 11.82-11.82 0-3.16-1.23-6.13-3.35-8.42Zm-8.48 18.2h-.01a9.86 9.86 0 0 1-5.02-1.38l-.36-.21-3.85 1.01 1.03-3.75-.23-.38a9.84 9.84 0 0 1-1.5-5.15c0-5.43 4.42-9.85 9.86-9.85 2.63 0 5.1 1.02 6.96 2.88a9.79 9.79 0 0 1 2.88 6.97c0 5.43-4.42 9.86-9.86 9.86Zm5.4-7.38c-.29-.15-1.72-.85-1.98-.95-.27-.1-.46-.15-.66.15-.19.29-.76.95-.93 1.14-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.45-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.49-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-.99 2.44.02 1.45 1.04 2.85 1.18 3.05.15.2 2.04 3.12 5.05 4.25.72.25 1.28.4 1.72.51.72.18 1.37.15 1.88.09.57-.07 1.72-.7 1.96-1.38.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34Z" />
                    </svg>
                    Falar no WhatsApp
                  </a>

                  <a
                    href={`mailto:${supportEmail}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8m-16 9h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"
                      />
                    </svg>
                    Enviar e-mail
                  </a>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Resumo do Atendimento</h2>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="rounded-xl bg-white/10 p-4">
                    <p className="text-slate-300">Perfis atendidos</p>
                    <p className="mt-1 font-semibold text-white">
                      Administradores, Contratados e Motoristas
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 p-4">
                    <p className="text-slate-300">Horário</p>
                    <p className="mt-1 font-semibold text-white">
                      Segunda a Sexta-feira
                      <br />
                      08:00 às 18:00 (Brasília)
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 p-4">
                    <p className="text-slate-300">Retorno fora do expediente</p>
                    <p className="mt-1 font-semibold text-white">
                      No próximo período útil
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Canais */}
          <section className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-1 rounded-full bg-emerald-500" />
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Canais Oficiais de Atendimento
                </h2>
                <p className="text-slate-600 text-sm">
                  Escolha o canal mais adequado para o seu atendimento.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20.52 3.48A11.8 11.8 0 0 0 12.04 0C5.52 0 .22 5.3.22 11.82c0 2.08.54 4.11 1.58 5.9L0 24l6.48-1.7a11.8 11.8 0 0 0 5.56 1.42h.01c6.52 0 11.82-5.3 11.82-11.82 0-3.16-1.23-6.13-3.35-8.42Z" />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      WhatsApp
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Canal ideal para suporte operacional, dúvidas rápidas e orientação imediata.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Operacional
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Contato oficial
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {whatsappDisplay}
                  </p>
                </div>

                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Abrir conversa
                </a>
              </div>

              <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8m-16 9h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"
                        />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      E-mail Técnico
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Recomendado para ocorrências técnicas, análises detalhadas e envio de evidências.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Técnico
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Endereço oficial
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900 break-all">
                    {supportEmail}
                  </p>
                </div>

                <a
                  href={`mailto:${supportEmail}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Enviar e-mail
                </a>
              </div>
            </div>
          </section>

          {/* Informações úteis */}
          <section className="mt-8 grid lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Antes de entrar em contato
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Nome de usuário</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Perfil de acesso: Administrador, Contratado ou Motorista</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Descrição detalhada do problema</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Prints da tela, se possível</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Horário de Atendimento
              </h3>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Disponibilidade</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  Segunda a Sexta-feira
                </p>
                <p className="text-sm text-slate-700">08:00 às 18:00 (Horário de Brasília)</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Solicitações enviadas fora do horário serão respondidas no próximo período útil.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Orientações de Segurança
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span>Nunca compartilhe sua senha com terceiros.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span>O suporte oficial não solicita códigos ou dados sensíveis fora dos canais oficiais.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span>Problemas de internet ou configuração do dispositivo podem impactar o funcionamento da plataforma.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Sobre */}
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Sobre o Sistema GeoTower
                </h2>
                <p className="mt-3 text-slate-600 leading-7">
                  O <strong>Sistema GeoTower</strong> é uma plataforma de gestão inteligente de entregas,
                  desenvolvida para otimizar o controle logístico, o acompanhamento operacional
                  e a administração de usuários em diferentes níveis de acesso.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleBack}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Voltar
                </button>

                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Solicitar suporte
                </a>
              </div>
            </div>
          </section>

          {/* Rodapé */}
          <footer className="mt-8 pb-4 text-center">
            <p className="text-sm font-semibold text-slate-700">
              Sistema GeoTower — Gestão Inteligente de Entregas
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Central de suporte oficial da plataforma
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Suporte;