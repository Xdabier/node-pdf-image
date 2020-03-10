# pdf-image

Provides an interface to convert PDF's pages to png files in Node.js
by using ImageMagick.

## Installation

    npm install pdf-image

Ensure you have `convert`, `gs`, and `pdfinfo` (part of poppler) commands.

### Ubuntu

    sudo apt-get install imagemagick ghostscript poppler-utils

### OSX (Yosemite)

    brew install imagemagick ghostscript poppler

## Usage

#### Convert single page:
```javascript
var PDFImage = require("pdf-image").PDFImage;

var pdfImage = new PDFImage("/tmp/slide.pdf");
pdfImage.convertPage(0).then(function (imagePath) {
  // 0-th page (first page) of the slide.pdf is available as slide-0.png
  fs.existsSync("/tmp/slide-0.png") // => true
});
```

#### Convert full file
```javascript
var PDFImage = require("pdf-image").PDFImage;

var pdfImage = new PDFImage("/tmp/slide.pdf");
pdfImage.convertFile().then(function (imagePaths) {
  // [ /tmp/slide-0.png, /tmp/slide-1.png ]
});


```
#### Convert full file and merge result into single image
```javascript
var PDFImage = require("pdf-image").PDFImage;
var pdfImage = new PDFImage("/tmp/slide.pdf", {
  combinedImage: true
});

pdfImage.convertFile().then(function (imagePaths) {
   // /tmp/slide.png 
});
```



#### Convert full file (TypeScript)
```typescript
import {PDFImage, PDFImageOptions} from 'pdf-image';

const pdfImageOptions: PDFImageOptions = {
        convertExtension: 'png',
        convertOptions: {
            "-resize": '1240x1754',
            "-quality": '100',
            "-strip": '',
            "-density": '100',
            "-alpha": 'off'
        }
    };

const pdfFile = new PDFImage("/tpm/slide.pdf", pdfImageOptions);

pdfFile.convertFile().then((imagePaths) => {
                            // ["/tpm/slide-0.pdf", "/tpm/slide-1.pdf", ...]
                        })
```

## Express

Following example shows an example of pdf-image in Express, which gives
URLs for each pages of a PDF like
`http://example.com:3000/tmp/slide.pdf/0.png`.

```javascript
  app.get(/(.*\.pdf)\/([0-9]+).png$/i, function (req, res) {
    var pdfPath = req.params[0];
    var pageNumber = req.params[1];

    var PDFImage = require("pdf-image").PDFImage;
    var pdfImage = new PDFImage(pdfPath);

    pdfImage.convertPage(pageNumber).then(function (imagePath) {
      res.sendFile(imagePath);
    }, function (err) {
      res.send(err, 500);
    });
  });
```

### Issues

You maybe face permissions issue, something like this error: 
    
    convert-im6. q16: not authorized

In this case you can execute this command on linux: 

     sudo mv /etc/ImageMagick-6/policy.xml /etc/ImageMagick-6/policy.xmlout

## Options

Following example shows an example of how to add imagemagick command-line options (you can find the complete list here -> http://www.imagemagick.org/script/convert.php):

```javascript
var pdfImage = new PDFImage(pdfPath, {
  convertOptions: {
    "-resize": "2000x2000",
    "-quality": "75"
  }
});
```
