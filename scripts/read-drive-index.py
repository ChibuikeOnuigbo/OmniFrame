"""Index publicly readable Drive folder entries without treating listings as downloads."""
import json,re,argparse
from html.parser import HTMLParser
from pathlib import Path
class DriveIndex(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.items={}
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);key=a.get('data-id');parent=self.stack[-1][1] if self.stack else None
  if key and re.fullmatch(r'[\w-]{20,}',key):parent=key;self.items.setdefault(key,{'id':key})
  label=a.get('aria-label','')
  if parent and (re.search(r' (?:Video|Image|Shared folder|Folder|Document|Compressed archive|ZIP)(?: Shared)?$',label,re.I)):
   self.items[parent]['label']=label;self.items[parent]['folder']='folder' in label.lower()
  if tag not in {'meta','link','input','img','br','hr','source','wbr'}:self.stack.append((tag,parent))
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==tag:self.stack=self.stack[:i];break
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('html');parser.add_argument('out');args=parser.parse_args();index=DriveIndex();index.feed(Path(args.html).read_text());items=[x for x in index.items.values() if 'label'in x];Path(args.out).write_text(json.dumps(items,indent=2)+'\n');print('Indexed',len(items),'listing entries; downloaded media not implied')
