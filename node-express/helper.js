const validateFileSize = (size, type) => {
    let result;
    switch(type){
        case 'pdf':
            result = size<=2 * 1024 *1024;
            break;
        case 'jpeg':
        case 'png':
        case 'jpg':
            result = size <= 500;
            break
    }
    return result
}

module.exports = {
    validateFileSize
}