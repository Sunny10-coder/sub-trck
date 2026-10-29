from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
out=root/'assets/images';out.mkdir(parents=True,exist_ok=True)
def icon(size):
 im=Image.new('RGB',(size,size),'#F7F4ED');d=ImageDraw.Draw(im)
 d.rounded_rectangle((size*.12,size*.12,size*.88,size*.88),radius=size*.12,fill='#FCE34D',outline='#171714',width=max(2,int(size*.045)))
 f=ImageFont.truetype(str(root/'assets/fonts/Display.ttf'),int(size*.55))
 box=d.textbbox((0,0),'M',font=f); d.text(((size-(box[2]-box[0]))/2,(size-(box[3]-box[1]))/2-box[1]),'M',font=f,fill='#171714')
 return im
for name,size in [('icon.png',1024),('adaptive-icon.png',1024),('favicon.png',64),('splash-image.png',512)]:
 icon(size).save(out/name)
print('Brand assets generated')
