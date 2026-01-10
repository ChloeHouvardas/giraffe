import {useState} from 'react'

interface FileUploadProps {
    accept: string
    label: string

    onFileSelect: (file: File) => void
}

export default function FileUpload({accept})