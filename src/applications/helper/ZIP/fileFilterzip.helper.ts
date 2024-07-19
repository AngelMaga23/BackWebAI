

export const fileFilterZip = ( req: Express.Request, file: Express.Multer.File, callback: Function ) => {

    // console.log({ file })
    if ( !file ) return callback( new Error('File is empty'), false );


    const fileExptension = file.mimetype.split('/')[1];
    const validExtensions = ['zip'];

    if (  validExtensions.includes( fileExptension ) ) {
        return callback( null, true )
    }

    callback(null, false );

}
