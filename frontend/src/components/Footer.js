import React from 'react';
import { FaMapMarkerAlt, FaWhatsapp, FaInstagram, FaPhone, FaEnvelope } from 'react-icons/fa';
import { useCity } from '../context/CityContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { city } = useCity();

  const getGerenciaInfo = () => {
    if (city === 'itajai') {
      return {
        name: 'Leandro',
        whatsapp: '5547968825522',
        display: '(47) 9682-5522'
      };
    }
    return {
      name: 'Igo Ferro',
      whatsapp: '5592982760023',
      display: '(92) 98276-0023'
    };
  };

  const getOperacionalInfo = () => {
    if (city === 'itajai') {
      return [
        { name: 'Lian', whatsapp: '5547975400775', display: '(47) 9754-0075' },
        { name: 'Adlar', whatsapp: '5547966249992', display: '(47) 9662-4992' }
      ];
    }
    return [
      { name: 'Daniela Pontes', whatsapp: '5592982410180', display: '(92) 98241-0180' },
      { name: 'Lia Lima', whatsapp: '5592982410138', display: '(92) 98241-0138' }
    ];
  };

  const gerenciaInfo = getGerenciaInfo();
  const operacionalInfo = getOperacionalInfo();

  return (
    <footer className="mt-16 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-20">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="mb-6">
              <img 
                src="https://www.geotransportes.com.br/lovable-uploads/1370f489-a7bc-4d3b-a916-4e11a73378f0.png" 
                alt="GeoTower" 
                className="h-12 md:h-14 mb-4" 
              />
              <h3 className="text-2xl font-bold mb-2">
                Geo<span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">Transportes</span>
              </h3>
              <p className="text-gray-300 text-sm font-medium mb-1">Logística Rodoviária</p>
              <p className="text-gray-400 text-xs">Soluções em transporte de carga</p>
            </div>

            {/* Social Links */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-700">
              <a 
                href="https://www.instagram.com/_grupogeo/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center hover:scale-110 transition-transform duration-300 shadow-lg"
                title="Instagram"
              >
                <FaInstagram className="text-white text-lg" />
              </a>
              <a 
                href="mailto:contato@geotower.com.br" 
                className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-gray-600 flex items-center justify-center transition-colors duration-300"
                title="Email"
              >
                <FaEnvelope className="text-white text-lg" />
              </a>
            </div>
          </div>

          {/* Locations */}
          <div>
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2 pb-3 border-b border-purple-500">
              <FaMapMarkerAlt className="text-purple-400" />
              Localidades
            </h4>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-white mb-1">Itajaí - SC</p>
                <p className="text-gray-400 text-sm">Av Itaipava</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Garuva - SC</p>
                <p className="text-gray-400 text-sm">BR-101, Km 10</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Manaus - AM</p>
                <p className="text-gray-400 text-sm">Rua Gisele</p>
              </div>
            </div>
          </div>

          {/* Contact - Management */}
          <div>
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2 pb-3 border-b border-blue-500">
              <FaPhone className="text-blue-400" />
              Gerência
            </h4>
            <div className="space-y-4">
              <a 
                href={`https://wa.me/${gerenciaInfo.whatsapp}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="block hover:translate-x-1 transition-transform duration-300"
              >
                <p className="font-semibold text-white mb-1 flex items-center gap-2">
                  <FaWhatsapp className="text-green-400 text-sm" />
                  {gerenciaInfo.name}
                </p>
                <p className="text-gray-400 text-sm ml-6">{gerenciaInfo.display}</p>
              </a>
            </div>
          </div>

          {/* Contact - Operations */}
          <div>
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2 pb-3 border-b border-green-500">
              <FaPhone className="text-green-400" />
              Operacional
            </h4>
            <div className="space-y-4">
              {operacionalInfo.map((contact, idx) => (
                <a 
                  key={idx}
                  href={`https://wa.me/${contact.whatsapp}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block hover:translate-x-1 transition-transform duration-300"
                >
                  <p className="font-semibold text-white mb-1 flex items-center gap-2">
                    <FaWhatsapp className="text-green-400 text-sm" />
                    {contact.name}
                  </p>
                  <p className="text-gray-400 text-sm ml-6">{contact.display}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent my-12"></div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-gray-400 text-sm text-center md:text-left">
            © {currentYear} <span className="font-semibold text-white">GeoTower</span> • Todos os direitos reservados
          </p>
          <div className="flex gap-6 text-gray-400 text-xs">
            <a href="/politica-privacidade" className="hover:text-white transition-colors">Política de Privacidade</a>
            <a href="/termos-uso" className="hover:text-white transition-colors">Termos de Uso</a>
            <a href="/suporte" className="hover:text-white transition-colors">Suporte</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
