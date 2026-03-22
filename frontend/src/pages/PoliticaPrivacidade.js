import React from 'react';

const sections = [
  {
    id: '01',
    title: 'Definições',
    content: (
      <ul className="space-y-2 text-slate-700 leading-relaxed">
        <li><b>Plataforma:</b> Sistema GeoTower (site e aplicativo).</li>
        <li><b>Usuário:</b> qualquer pessoa com acesso autorizado ao sistema, incluindo Administradores, Contratados e Motoristas.</li>
        <li><b>Dados Pessoais:</b> informações que identificam ou podem identificar uma pessoa natural.</li>
      </ul>
    ),
  },
  {
    id: '02',
    title: 'Dados Coletados',
    content: (
      <div className="space-y-3 text-slate-700 leading-relaxed">
        <ul className="space-y-2">
          <li><b>Dados fornecidos pelo usuário:</b> Nome, identificação, login, credenciais, informações operacionais de entregas, dados vinculados a motoristas, administradores e contratados.</li>
          <li><b>Dados coletados automaticamente:</b> Endereço IP, tipo de dispositivo e navegador, data e hora de acesso, informações de sessão e autenticação.</li>
        </ul>
        <p>Esses dados são utilizados exclusivamente para funcionamento da plataforma e segurança operacional.</p>
      </div>
    ),
  },
  {
    id: '03',
    title: 'Finalidade do Tratamento dos Dados',
    content: (
      <ul className="space-y-2 text-slate-700 leading-relaxed">
        <li>Autenticação e controle de acesso</li>
        <li>Gestão logística e acompanhamento de entregas</li>
        <li>Administração de perfis</li>
        <li>Monitoramento de desempenho e estabilidade do sistema</li>
        <li>Prevenção contra fraudes e acessos indevidos</li>
        <li>Suporte técnico e melhoria contínua da plataforma</li>
      </ul>
    ),
  },
  {
    id: '04',
    title: 'Base Legal (LGPD)',
    content: (
      <ul className="space-y-2 text-slate-700 leading-relaxed">
        <li>Execução de contrato e procedimentos preliminares</li>
        <li>Cumprimento de obrigação legal ou regulatória</li>
        <li>Legítimo interesse para operação logística e segurança da plataforma</li>
      </ul>
    ),
  },
  {
    id: '05',
    title: 'Compartilhamento de Dados',
    content: (
      <p className="text-slate-700 leading-relaxed">
        O Sistema GeoTower não comercializa dados pessoais. As informações poderão ser compartilhadas apenas quando necessário com serviços de hospedagem, infraestrutura em nuvem, ferramentas técnicas essenciais ao funcionamento da plataforma e autoridades legais, mediante obrigação jurídica.
      </p>
    ),
  },
  {
    id: '06',
    title: 'Segurança das Informações',
    content: (
      <div className="space-y-3 text-slate-700 leading-relaxed">
        <ul className="space-y-2">
          <li>Controle de acesso por perfil</li>
          <li>Criptografia de senhas</li>
          <li>Monitoramento de sessões</li>
          <li>Restrição de permissões conforme nível do usuário</li>
        </ul>
        <p>
          Apesar dos esforços, nenhum sistema é totalmente imune a riscos, e o usuário também é responsável pela proteção de suas credenciais.
        </p>
      </div>
    ),
  },
  {
    id: '07',
    title: 'Cookies e Tecnologias de Sessão',
    content: (
      <p className="text-slate-700 leading-relaxed">
        A plataforma pode utilizar cookies e tecnologias similares para manter usuários autenticados, melhorar a experiência de navegação e garantir segurança durante o uso. O usuário pode desativar cookies no navegador, podendo afetar algumas funcionalidades.
      </p>
    ),
  },
  {
    id: '08',
    title: 'Direitos do Titular dos Dados',
    content: (
      <div className="space-y-3 text-slate-700 leading-relaxed">
        <ul className="space-y-2">
          <li>Confirmação da existência de tratamento de dados</li>
          <li>Acesso aos dados pessoais</li>
          <li>Correção de dados incompletos ou desatualizados</li>
          <li>Anonimização ou exclusão quando aplicável</li>
        </ul>
        <p>As solicitações podem ser feitas através dos canais oficiais da plataforma.</p>
      </div>
    ),
  },
  {
    id: '09',
    title: 'Privacidade no Aplicativo Mobile',
    content: (
      <p className="text-slate-700 leading-relaxed">
        O aplicativo não acessa contatos pessoais, fotos ou arquivos do dispositivo sem autorização explícita. O uso das informações segue os mesmos princípios desta Política.
      </p>
    ),
  },
  {
    id: '10',
    title: 'Retenção dos Dados',
    content: (
      <p className="text-slate-700 leading-relaxed">
        Os dados serão armazenados apenas pelo período necessário para cumprimento das finalidades operacionais, obrigações legais e auditorias, segurança e integridade do sistema.
      </p>
    ),
  },
  {
    id: '11',
    title: 'Alterações desta Política',
    content: (
      <p className="text-slate-700 leading-relaxed">
        Esta Política poderá ser atualizada a qualquer momento para refletir melhorias técnicas, mudanças legais ou atualizações da plataforma. A versão mais recente estará sempre disponível no sistema.
      </p>
    ),
  },
  {
    id: '12',
    title: 'Contato e Responsável pelo Tratamento',
    content: (
      <p className="text-slate-700 leading-relaxed">
        Para dúvidas, solicitações ou informações relacionadas à privacidade e proteção de dados, o usuário deve utilizar os canais oficiais do Sistema GeoTower disponibilizados na própria plataforma.
      </p>
    ),
  },
];

const PoliticaPrivacidade = () => {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 sm:px-6 lg:px-8">
      {/* Efeitos decorativos */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* Botão Voltar */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:shadow-lg hover:shadow-cyan-500/10"
          >
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
        </div>

        {/* Header principal */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-900 px-6 py-10 sm:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_35%)]" />

            <div className="relative z-10">
              <div className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Privacidade & Proteção de Dados
              </div>

              <h1 className="max-w-4xl text-3xl font-bold leading-tight text-white sm:text-4xl">
                Política de Privacidade — Sistema GeoTower
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
                Esta Política de Privacidade descreve como o <b>Sistema GeoTower</b>, plataforma de gestão logística e controle de entregas, coleta, utiliza, armazena e protege as informações dos usuários.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white">
                  Última atualização: 24 de fevereiro de 2026
                </span>

                <a
                  href="https://entregascomgeotransportes.onrender.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
                >
                  Acessar plataforma
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Introdução */}
          <div className="px-6 py-8 sm:px-10">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-6">
              <p className="text-base leading-8 text-slate-700">
                Ao utilizar o Sistema GeoTower, o usuário declara estar ciente e de acordo com os termos desta Política, bem como com a legislação vigente, especialmente a Lei Geral de Proteção de Dados Pessoais — <b>LGPD (Lei nº 13.709/2018)</b>.
              </p>
            </div>
          </div>

          {/* Seções */}
          <div className="px-6 pb-10 sm:px-10">
            <div className="grid gap-5">
              {sections.map((section) => (
                <section
                  key={section.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-blue-700 text-sm font-bold text-white shadow-md">
                      {section.id}
                    </div>

                    <div className="flex-1">
                      <h2 className="mb-3 text-xl font-bold text-slate-900">
                        {section.title}
                      </h2>
                      <div>{section.content}</div>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-[1px]">
              <div className="rounded-2xl bg-slate-950 px-6 py-7 text-white">
                <p className="text-lg font-semibold tracking-wide">
                  Sistema GeoTower — Gestão Inteligente de Entregas
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Comprometido com segurança, transparência e conformidade no tratamento de dados em todos os pontos da operação logística.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
