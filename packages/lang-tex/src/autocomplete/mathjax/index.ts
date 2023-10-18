import { completeFromList } from '@codemirror/autocomplete';
import { texLanguage } from '../../tex';
import mathjaxSnippetDefinitions from './mathjax.snippet.json';
import { Extension } from '@codemirror/state';

// A collection of MathJax snippets for autocompletion.
export const mathjaxCompletion : Extension = texLanguage.data.of({
  autocomplete: completeFromList(mathjaxSnippetDefinitions),
});
