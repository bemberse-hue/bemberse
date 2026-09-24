import './style.css';
import './site.css';
import { mountLangOffer, mountLangSwitch } from '@/ui/langSwitch';

/**
 * Entry de las paginas provisionales del ecosistema (/routes/, /templates/,
 * /circle/ y sus versiones en /es/). Son estaticas a proposito: solo cargan
 * tokens, layout del sitio y el cambio de idioma. Cuando un producto exista
 * de verdad, su pagina deja de usar este entry y tendra el suyo propio.
 */

mountLangSwitch();
mountLangOffer();
