const fs = require('fs');
const path = require('path');

function copyFileSync(source, target) {
  let targetFile = target;

    // If target is a directory a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  let files = [];

  // Check if folder needs to be created or integrated
  let targetFolder = path.join(target, path.basename(source));  
  if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder);
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
      files = fs.readdirSync(source);
      files.forEach(function(file) {
          let curSource = path.join(source, file);
          if (fs.lstatSync(curSource).isDirectory()) {
              copyFolderRecursiveSync(curSource, targetFolder);
          } else {
              copyFileSync(curSource, targetFolder);
          }
      });
  }
}

// Copy certs folder to build
copyFolderRecursiveSync('./src/certs', './dist');
// Copy views folder to build
copyFolderRecursiveSync('./src/views', './dist');
