import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import config from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadedFiles = []

    for (const file of files) {
      // Validate file size
      if (file.size > config.files.maxSize) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum size of ${config.files.maxSize} bytes` },
          { status: 400 }
        )
      }

      // Validate file type
      if (config.files.allowedTypes.length > 0 && !config.files.allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} not allowed` },
          { status: 400 }
        )
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop()
      const uniqueFilename = `${uuidv4()}.${fileExtension}`
      
      // Create upload directory if it doesn't exist
      const uploadDir = join(process.cwd(), 'public', 'uploads')
      await mkdir(uploadDir, { recursive: true })

      // Save file
      const filePath = join(uploadDir, uniqueFilename)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      await writeFile(filePath, buffer)

      uploadedFiles.push({
        id: uuidv4(),
        originalName: file.name,
        filename: uniqueFilename,
        path: `/uploads/${uniqueFilename}`,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
