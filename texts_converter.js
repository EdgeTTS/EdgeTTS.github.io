//FB2 to TXT
function convertFb2ToTxt(fb2String) {
  const parser = new DOMParser();
  const fb2Doc = parser.parseFromString(fb2String, 'application/xml');
  let textContent = '';
  const bodyNode = fb2Doc.getElementsByTagName('body')[0];
  if (bodyNode) {
    const sectionNodes = bodyNode.getElementsByTagName('section');
    for (let i = 0; i < sectionNodes.length; i++) {
      const sectionNode = sectionNodes[i];
      const sectionText = sectionNode.textContent;
      textContent += sectionText + '\n\n';
    }
  }
  const txtString = textContent.trim();
  return txtString;
}